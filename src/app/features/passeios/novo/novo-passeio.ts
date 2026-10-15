import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import { formatarKm } from '../../../core/formato';
import { CENTRO_PADRAO, distanciaEntre, distanciaTrajeto } from '../../../core/geo';
import { LatLng, Pet, Rota } from '../../../core/models';
import { PasseiosService } from '../../../core/passeios.service';
import { RotasService } from '../../../core/rotas.service';
import { Avatar } from '../../../shared/avatar/avatar';
import { Mapa, MarcadorMapa, TrajetoMapa } from '../../../shared/mapa/mapa';

type Modo = 'desenho' | 'gps';
type EstadoGps = 'parado' | 'gravando' | 'pausado' | 'encerrado';

const MODOS: readonly { id: Modo; label: string }[] = [
  { id: 'desenho', label: 'Desenhar no mapa' },
  { id: 'gps', label: 'Gravar com GPS' },
];

/** Leituras menos precisas que isso (em metros) são descartadas. */
const PRECISAO_MAXIMA_M = 50;
/** Deslocamentos menores que isso (em metros) não viram um novo ponto. */
const DESLOCAMENTO_MINIMO_M = 5;

function formatarCronometro(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

@Component({
  selector: 'app-novo-passeio',
  imports: [ReactiveFormsModule, RouterLink, Avatar, Mapa],
  templateUrl: './novo-passeio.html',
  styleUrl: './novo-passeio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoPasseio {
  private readonly router = inject(Router);
  private readonly rotasService = inject(RotasService);
  private readonly passeiosService = inject(PasseiosService);
  private readonly fb = inject(FormBuilder);
  private readonly perfil = inject(AuthService).perfil;

  /** Id de uma rota existente, vindo de `?rota=ID`. */
  readonly rota = input(undefined, { transform: numberAttribute });

  protected readonly modos = MODOS;
  protected readonly formatarKm = formatarKm;

  protected readonly modo = signal<Modo>('desenho');
  protected readonly pontos = signal<LatLng[]>([]);
  /** Rota existente em que o passeio está sendo feito, se houver. */
  protected readonly rotaBase = signal<Rota | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    duracaoMin: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    texto: [''],
    salvarRota: [false],
    nomeRota: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(60)]],
    bairroRota: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(60)]],
  });

  /** Sem zone.js: os erros do template são recalculados a partir dos eventos do form. */
  private readonly formEvents = toSignal(this.form.events);
  protected readonly salvarRota = toSignal(this.form.controls.salvarRota.valueChanges, {
    initialValue: false,
  });

  // --- Pets ------------------------------------------------------------------
  protected readonly pets = computed(() => this.perfil()?.pets ?? []);
  /**
   * Começa com todos. Se o perfil for recarregado, mantém a escolha (sem pets que
   * deixaram de existir); se não sobrar nenhum, volta a marcar todos.
   */
  protected readonly petsEscolhidos = linkedSignal<Pet[], number[]>({
    source: this.pets,
    computation: (pets, anterior) => {
      const ids = pets.map((p) => p.id);
      const mantidos = anterior?.value.filter((id) => ids.includes(id)) ?? [];
      return mantidos.length ? mantidos : ids;
    },
  });

  protected readonly tentouEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  // --- GPS -------------------------------------------------------------------
  protected readonly estadoGps = signal<EstadoGps>('parado');
  protected readonly posicaoAtual = signal<LatLng | null>(null);
  protected readonly erroGps = signal<string | null>(null);
  private watchId: number | null = null;
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private acumuladoMs = 0;
  private inicioTrecho = 0;
  private readonly decorridoMs = signal(0);
  protected readonly cronometro = computed(() => formatarCronometro(this.decorridoMs()));

  // --- Derivados -------------------------------------------------------------
  protected readonly distanciaKm = computed(() => distanciaTrajeto(this.pontos()));

  protected readonly pontosErro = computed(() =>
    this.tentouEnviar() && this.pontos().length < 2
      ? 'Marque pelo menos 2 pontos do trajeto.'
      : null,
  );

  /** Sem o perfil carregado não há o que escolher: a API usa todos os pets. */
  private readonly faltaPet = computed(
    () => this.pets().length > 0 && !this.petsEscolhidos().length,
  );

  protected readonly petsErro = computed(() =>
    this.tentouEnviar() && this.faltaPet() ? 'Escolha quem foi passear.' : null,
  );

  protected readonly duracaoErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.duracaoMin;
    if (!c.touched || c.valid) return null;
    return c.hasError('required') ? 'Informe quanto tempo durou.' : 'A duração mínima é 1 minuto.';
  });

  protected readonly nomeRotaErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.nomeRota;
    return c.enabled && c.touched && c.invalid ? 'Dê um nome para a rota.' : null;
  });

  protected readonly bairroRotaErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.bairroRota;
    return c.enabled && c.touched && c.invalid ? 'Informe o bairro da rota.' : null;
  });

  protected readonly trajetos = computed<TrajetoMapa[]>(() =>
    this.pontos().length ? [{ id: 'passeio', pontos: this.pontos(), destaque: true }] : [],
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const lista: MarcadorMapa[] = [];
    const inicio = this.pontos()[0];
    if (inicio) lista.push({ id: 'inicio', posicao: inicio, titulo: 'Início', tipo: 'destaque' });
    const eu = this.posicaoAtual();
    if (this.modo() === 'gps' && eu) {
      lista.push({ id: 'eu', posicao: eu, titulo: 'Você está aqui', tipo: 'eu' });
    }
    return lista;
  });

  /**
   * No desenho o centro fica fixo no início do trajeto, para o mapa não pular a cada
   * clique; na gravação ele acompanha o GPS.
   */
  protected readonly centro = computed<LatLng>(() => {
    if (this.modo() === 'gps') {
      return this.posicaoAtual() ?? this.pontos().at(-1) ?? CENTRO_PADRAO;
    }
    return this.pontos()[0] ?? CENTRO_PADRAO;
  });

  /** Mostra a rota pré-carregada inteira; depois que o tutor mexe, o mapa para de se ajustar. */
  protected readonly enquadrar = computed(
    () => this.modo() === 'desenho' && this.pontos() === this.rotaBase()?.pontos,
  );

  constructor() {
    this.form.controls.salvarRota.valueChanges.pipe(takeUntilDestroyed()).subscribe((salvar) => {
      for (const c of [this.form.controls.nomeRota, this.form.controls.bairroRota]) {
        if (salvar) c.enable();
        else c.disable();
      }
    });

    // A rota de `?rota=ID` pode chegar só depois que a lista vem da API;
    // pré-carrega uma vez, para não desfazer o que o tutor já mexeu.
    this.rotasService.carregar();
    let preCarregada = false;
    effect(() => {
      const id = this.rota();
      const rota = id === undefined || Number.isNaN(id) ? undefined : this.rotasService.porId(id);
      if (rota && !preCarregada) {
        preCarregada = true;
        untracked(() => this.usarRota(rota));
      }
    });

    inject(DestroyRef).onDestroy(() => this.pararGps());
  }

  private usarRota(rota: Rota): void {
    this.rotaBase.set(rota);
    this.pontos.set(rota.pontos);
    this.form.patchValue({
      duracaoMin: rota.duracaoMin,
      nomeRota: rota.nome,
      bairroRota: rota.bairro,
    });
  }

  protected alternarPet(id: number): void {
    this.petsEscolhidos.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }

  protected escolherModo(modo: Modo): void {
    if (modo === this.modo()) return;
    if (this.estadoGps() === 'gravando') this.pausar();
    this.modo.set(modo);
  }

  // --- Desenho ---------------------------------------------------------------
  protected adicionarPonto(ponto: LatLng): void {
    if (this.modo() !== 'desenho') return;
    this.pontos.update((lista) => [...lista, ponto]);
  }

  protected desfazerPonto(): void {
    this.pontos.update((lista) => lista.slice(0, -1));
  }

  protected limpar(): void {
    this.pontos.set([]);
    this.rotaBase.set(null);
  }

  // --- GPS -------------------------------------------------------------------
  protected iniciar(): void {
    this.erroGps.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.erroGps.set('Seu navegador não oferece localização. Desenhe o trajeto no mapa.');
      return;
    }
    if (this.estadoGps() === 'parado' || this.estadoGps() === 'encerrado') {
      this.acumuladoMs = 0;
      this.decorridoMs.set(0);
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.receberPosicao(pos),
      (erro) => this.falhaGps(erro),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    this.inicioTrecho = Date.now();
    this.intervalo = setInterval(() => this.atualizarCronometro(), 1000);
    this.estadoGps.set('gravando');
  }

  protected pausar(): void {
    this.fecharTrecho();
    this.estadoGps.set('pausado');
  }

  protected encerrar(): void {
    this.fecharTrecho();
    this.estadoGps.set('encerrado');
  }

  private receberPosicao({ coords }: GeolocationPosition): void {
    if (coords.accuracy > PRECISAO_MAXIMA_M) return;
    const ponto: LatLng = [coords.latitude, coords.longitude];
    this.posicaoAtual.set(ponto);
    const ultimo = this.pontos().at(-1);
    if (ultimo && distanciaEntre(ultimo, ponto) * 1000 < DESLOCAMENTO_MINIMO_M) return;
    this.pontos.update((lista) => [...lista, ponto]);
  }

  private falhaGps(erro: GeolocationPositionError): void {
    // 1 = PERMISSION_DENIED
    if (erro.code === 1) {
      this.erroGps.set(
        'Sem permissão para usar sua localização. Libere o acesso no navegador ou desenhe no mapa.',
      );
      this.pausar();
    } else {
      this.erroGps.set('Não conseguimos achar sua localização agora. Tentando de novo...');
    }
  }

  private atualizarCronometro(): void {
    const trecho = this.estadoGps() === 'gravando' ? Date.now() - this.inicioTrecho : 0;
    const ms = this.acumuladoMs + trecho;
    this.decorridoMs.set(ms);
    this.form.controls.duracaoMin.setValue(Math.max(1, Math.round(ms / 60_000)));
  }

  /** Para o watch e o relógio, somando o trecho gravado ao total. */
  private fecharTrecho(): void {
    if (this.estadoGps() === 'gravando') {
      this.atualizarCronometro();
      this.acumuladoMs += Date.now() - this.inicioTrecho;
    }
    this.pararGps();
  }

  private pararGps(): void {
    if (this.watchId !== null) {
      navigator.geolocation?.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  // --- Envio -----------------------------------------------------------------
  protected async registrar(): Promise<void> {
    this.tentouEnviar.set(true);
    this.erroGeral.set(null);

    if (this.estadoGps() === 'gravando') this.encerrar();

    if (this.pontos().length < 2 || this.form.invalid || this.faltaPet()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    try {
      const { duracaoMin, texto, salvarRota, nomeRota, bairroRota } = this.form.getRawValue();
      const pontos = this.pontos();
      const duracao = duracaoMin ?? 1;
      let rotaId = this.rotaBase()?.id ?? null;
      let rotaNome = this.rotaBase()?.nome ?? 'Passeio livre';

      if (salvarRota) {
        const nova = await this.rotasService.criar({
          nome: nomeRota.trim(),
          bairro: bairroRota.trim(),
          descricao: texto.trim(),
          pontos,
          duracaoMin: duracao,
        });
        rotaId = nova.id;
        rotaNome = nova.nome;
      }

      await this.passeiosService.registrar({
        pontos,
        duracaoMin: duracao,
        texto: texto.trim(),
        rotaId,
        rotaNome,
        // Na ordem do perfil, não na ordem em que foram marcados.
        petIds: this.pets()
          .map((p) => p.id)
          .filter((id) => this.petsEscolhidos().includes(id)),
      });
      await this.router.navigateByUrl('/');
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível registrar o passeio agora. Tente novamente.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
