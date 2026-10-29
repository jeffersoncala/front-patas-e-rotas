import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { formatarDuracao, formatarHora, formatarKm, linksTelefone } from '../../../core/formato';
import { CENTRO_PADRAO, distanciaEntre, distanciaTrajeto } from '../../../core/geo';
import { Contratacao, LatLng, nomesPets } from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Mapa, MarcadorMapa, TrajetoMapa } from '../../../shared/mapa/mapa';

/** De quanto em quanto tempo o passeador envia os pontos juntados. */
export const ENVIO_MS = 10_000;
/** De quanto em quanto tempo o tutor busca as novidades. */
export const CONSULTA_MS = 5_000;
/** Sem ponto novo por mais que isso, o tutor é avisado de que o sinal sumiu. */
const SEM_SINAL_MS = 90_000;
/** Leituras menos precisas que isso (em metros) são descartadas. */
const PRECISAO_MAXIMA_M = 50;
/** Só registra um ponto novo depois de andar isso (em metros), para não acumular ruído parado. */
const DESLOCAMENTO_MINIMO_M = 5;

/** Até 1 min em segundos; depois, em minutos. */
function haQuantoTempo(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  return segundos < 60 ? `${segundos} s` : `${Math.round(segundos / 60)} min`;
}

/**
 * Passeio contratado ao vivo. No celular do passeador, transmite o GPS do momento em que ele
 * pega o pet até devolver; no do tutor, mostra o trajeto e onde o pet está, atualizando sozinha.
 */
@Component({
  selector: 'app-passeio-ao-vivo',
  imports: [RouterLink, Mapa],
  templateUrl: './passeio-ao-vivo.html',
  styleUrl: './passeio-ao-vivo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasseioAoVivo {
  private readonly service = inject(ServicosService);
  private readonly router = inject(Router);

  /** Vem do parâmetro `:id` da URL. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly formatarKm = formatarKm;

  protected readonly pedido = signal<Contratacao | null>(null);
  protected readonly naoEncontrado = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly ocupado = signal(false);

  /** Todos os pontos que esta tela conhece, na ordem. */
  protected readonly pontos = signal<LatLng[]>([]);
  /** Tutor: quando chegou o último ponto na API. */
  private readonly posicaoEm = signal<string | null>(null);
  /** Relógio da tela, para o cronômetro e o "atualizado há". */
  private readonly agora = signal(Date.now());

  /** Passeador: pontos ainda não enviados. */
  private pendentes: LatLng[] = [];
  private enviando = false;
  private watchId: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private readonly intervalos: ReturnType<typeof setInterval>[] = [];

  protected readonly souPasseador = computed(() => this.pedido()?.papel === 'prestador');
  protected readonly status = computed(() => this.pedido()?.status);
  protected readonly transmitindo = signal(false);

  protected readonly nomesPets = computed(() => nomesPets(this.pedido()?.pets ?? []));
  /** A outra parte: o tutor vê o passeador, e vice-versa. */
  protected readonly outro = computed(() => {
    const p = this.pedido();
    if (!p) return null;
    const contato = p.papel === 'cliente' ? p.prestador.contato : p.contato;
    return {
      nome: p.papel === 'cliente' ? p.prestador.nome : p.cliente.nome,
      contato,
      telefone: linksTelefone(contato),
    };
  });

  protected readonly distancia = computed(() => formatarKm(distanciaTrajeto(this.pontos())));
  protected readonly duracao = computed(() => {
    const p = this.pedido();
    if (!p?.iniciadoEm) return null;
    const fim = p.finalizadoEm ? Date.parse(p.finalizadoEm) : this.agora();
    return formatarDuracao(Math.max(0, Math.round((fim - Date.parse(p.iniciadoEm)) / 60_000)));
  });
  protected readonly inicioHora = computed(() => {
    const iniciado = this.pedido()?.iniciadoEm;
    return iniciado ? formatarHora(iniciado) : null;
  });

  /** Tutor: há quanto tempo chegou o último ponto, e se já passou do normal. */
  protected readonly sinal = computed(() => {
    const em = this.posicaoEm();
    if (!em || this.status() !== 'em_andamento') return null;
    const ms = this.agora() - Date.parse(em);
    return { texto: haQuantoTempo(ms), atrasado: ms > SEM_SINAL_MS };
  });

  protected readonly trajetos = computed<TrajetoMapa[]>(() =>
    this.pontos().length > 1 ? [{ id: 'passeio', pontos: this.pontos(), destaque: true }] : [],
  );
  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const ultimo = this.pontos().at(-1);
    if (!ultimo) return [];
    const titulo =
      this.status() === 'concluida' ? 'Fim do passeio' : `${this.nomesPets()} está aqui`;
    return [{ id: 'pet', posicao: ultimo, titulo, tipo: 'destaque' }];
  });
  protected readonly centro = computed(() => this.pontos().at(-1) ?? CENTRO_PADRAO);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.carregar(id));
    });
    this.intervalos.push(setInterval(() => this.agora.set(Date.now()), 1000));

    const aoVoltar = () => {
      // O navegador solta o wake lock quando a aba some; pede de novo ao voltar.
      if (document.visibilityState === 'visible' && this.transmitindo()) this.manterTelaLigada();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', aoVoltar);
      this.intervalos.forEach(clearInterval);
      this.pararGps();
      // Tenta não perder os últimos pontos se o passeador sair da tela.
      void this.enviarPendentes();
    });
  }

  // --- Passeador ---------------------------------------------------------------

  protected async iniciar(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido) return;
    this.erro.set(null);
    this.ocupado.set(true);
    try {
      this.pedido.set(await this.service.mudarStatus(pedido.id, 'em_andamento'));
      this.transmitir();
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível iniciar o passeio. Tente novamente.'));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async encerrar(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido || !confirm(`Encerrar o passeio e marcar que ${this.nomesPets()} foi devolvido?`)) {
      return;
    }
    this.erro.set(null);
    this.ocupado.set(true);
    try {
      await this.enviarPendentes();
      await this.service.mudarStatus(pedido.id, 'concluida');
      this.pararGps();
      await this.router.navigate(['/servicos/pedidos'], { queryParams: { papel: 'prestador' } });
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível encerrar agora. Tente novamente.'));
    } finally {
      this.ocupado.set(false);
    }
  }

  private transmitir(): void {
    if (this.transmitindo()) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.erro.set('Este navegador não informa a localização, então o tutor não verá o trajeto.');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.receberPosicao(pos),
      (erro) =>
        this.aviso.set(
          // 1 = PERMISSION_DENIED
          erro.code === 1
            ? 'Sem permissão para usar sua localização: libere o acesso no navegador para o tutor acompanhar.'
            : 'Procurando o sinal do GPS…',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    this.intervalos.push(setInterval(() => void this.enviarPendentes(), ENVIO_MS));
    this.transmitindo.set(true);
    this.manterTelaLigada();
  }

  private receberPosicao({ coords }: GeolocationPosition): void {
    this.aviso.set(null);
    if (coords.accuracy > PRECISAO_MAXIMA_M) return;
    const ponto: LatLng = [coords.latitude, coords.longitude];
    const ultimo = this.pontos().at(-1);
    if (ultimo && distanciaEntre(ultimo, ponto) * 1000 < DESLOCAMENTO_MINIMO_M) return;
    this.pontos.update((lista) => [...lista, ponto]);
    this.pendentes.push(ponto);
  }

  /** Envia o que juntou; se falhar (ex.: sem rede), os pontos ficam para a próxima. */
  private async enviarPendentes(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido || this.enviando || !this.pendentes.length) return;
    this.enviando = true;
    const lote = this.pendentes.slice(0, 200);
    try {
      await this.service.enviarPosicoes(pedido.id, lote);
      this.pendentes = this.pendentes.slice(lote.length);
    } catch {
      this.aviso.set('Sem conexão: o trajeto será enviado assim que a internet voltar.');
    } finally {
      this.enviando = false;
    }
  }

  private pararGps(): void {
    if (this.watchId !== null) navigator.geolocation?.clearWatch(this.watchId);
    this.watchId = null;
    this.transmitindo.set(false);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  /** Com a tela apagada o navegador para o GPS; pede para ela ficar ligada, quando dá. */
  private async manterTelaLigada(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Sem suporte ou sem permissão: o aviso na tela já orienta o passeador.
    }
  }

  // --- Tutor -------------------------------------------------------------------

  private async atualizar(): Promise<void> {
    const pedido = this.pedido();
    if (!pedido || document.hidden) return;
    try {
      const novo = await this.service.acompanhamento(pedido.id, this.pontos().length);
      this.pontos.update((lista) => [...lista, ...novo.pontos]);
      this.posicaoEm.set(novo.posicaoEm);
      if (novo.status !== pedido.status) {
        // Começou ou terminou: busca o pedido de novo para pegar os horários.
        this.pedido.set(await this.service.pedido(pedido.id));
      }
    } catch {
      // Falha passageira de rede: a próxima consulta tenta de novo.
    }
  }

  // --- Os dois -----------------------------------------------------------------

  private async carregar(id: number): Promise<void> {
    try {
      const [pedido, acompanhamento] = await Promise.all([
        this.service.pedido(id),
        this.service.acompanhamento(id),
      ]);
      if (pedido.prestador.tipo !== 'passeador') {
        this.naoEncontrado.set(true);
        return;
      }
      this.pedido.set(pedido);
      this.pontos.set(acompanhamento.pontos);
      this.posicaoEm.set(acompanhamento.posicaoEm);

      const aberto = pedido.status === 'aceita' || pedido.status === 'em_andamento';
      if (pedido.papel === 'prestador') {
        // Recarregou a tela no meio do passeio: volta a transmitir.
        if (pedido.status === 'em_andamento') this.transmitir();
      } else if (aberto) {
        this.intervalos.push(
          setInterval(() => {
            if (['aceita', 'em_andamento'].includes(this.status()!)) void this.atualizar();
          }, CONSULTA_MS),
        );
      }
    } catch {
      this.naoEncontrado.set(true);
    }
  }
}
