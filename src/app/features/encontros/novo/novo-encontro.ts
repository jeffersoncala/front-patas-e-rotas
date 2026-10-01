import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { EncontrosService } from '../../../core/encontros.service';
import { CENTRO_PADRAO } from '../../../core/geo';
import { LatLng } from '../../../core/models';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

/** A data do encontro (valor de um datetime-local) precisa estar no futuro. */
function noFuturo(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
  const data = new Date(control.value).getTime();
  if (Number.isNaN(data)) return { dataInvalida: true };
  return data > Date.now() ? null : { passado: true };
}

/** Formato aceito pelo atributo `min` do datetime-local, no fuso local. */
function paraDatetimeLocal(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`;
}

@Component({
  selector: 'app-novo-encontro',
  imports: [ReactiveFormsModule, RouterLink, Mapa],
  templateUrl: './novo-encontro.html',
  styleUrl: './novo-encontro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoEncontro {
  private readonly router = inject(Router);
  private readonly encontrosService = inject(EncontrosService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    titulo: ['', [Validators.required, Validators.pattern(/\S/)]],
    descricao: [''],
    local: ['', [Validators.required, Validators.pattern(/\S/)]],
    data: ['', [Validators.required, noFuturo]],
    posicao: new FormControl<LatLng | null>(null, Validators.required),
  });

  /** Sem zone.js: os eventos do formulário viram signal para recalcular erros e mapa. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly dataMinima = paraDatetimeLocal(new Date());
  protected readonly minhaPosicao = signal<LatLng | null>(null);
  protected readonly localizando = signal(false);
  protected readonly erroLocalizacao = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly posicao = computed(() => {
    this.formEvents();
    return this.form.controls.posicao.value;
  });

  protected readonly centro = computed<LatLng>(
    () => this.posicao() ?? this.minhaPosicao() ?? CENTRO_PADRAO,
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const marcadores: MarcadorMapa[] = [];
    const eu = this.minhaPosicao();
    const escolhida = this.posicao();
    if (eu) marcadores.push({ id: 'eu', posicao: eu, titulo: 'Você está aqui', tipo: 'eu' });
    if (escolhida) {
      marcadores.push({ id: 'local', posicao: escolhida, titulo: 'Local do encontro', tipo: 'destaque' });
    }
    return marcadores;
  });

  protected readonly tituloErro = computed(() =>
    this.erroObrigatorio('titulo', 'Dê um nome para o encontro.'),
  );

  protected readonly localErro = computed(() =>
    this.erroObrigatorio('local', 'Diga onde a turma vai se reunir.'),
  );

  protected readonly dataErro = computed(() => {
    this.formEvents();
    const data = this.form.controls.data;
    if (!data.touched || data.valid) return null;
    if (data.hasError('required')) return 'Escolha o dia e a hora do encontro.';
    if (data.hasError('passado')) return 'O encontro precisa ser no futuro.';
    return 'Essa data não parece válida.';
  });

  protected readonly posicaoErro = computed(() => {
    this.formEvents();
    const posicao = this.form.controls.posicao;
    return posicao.touched && posicao.invalid ? 'Toque no mapa para marcar o ponto de encontro.' : null;
  });

  /** Clique no mapa define o ponto de encontro. */
  protected escolherPosicao(posicao: LatLng): void {
    const controle = this.form.controls.posicao;
    controle.setValue(posicao);
    controle.markAsTouched();
  }

  protected usarMinhaLocalizacao(): void {
    this.erroLocalizacao.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.erroLocalizacao.set('Seu navegador não informa a localização. Toque no mapa para marcar.');
      return;
    }
    this.localizando.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const posicao: LatLng = [coords.latitude, coords.longitude];
        this.localizando.set(false);
        this.minhaPosicao.set(posicao);
        this.escolherPosicao(posicao);
      },
      (erro) => {
        this.localizando.set(false);
        this.erroLocalizacao.set(
          erro.code === erro.PERMISSION_DENIED
            ? 'Sem permissão para usar sua localização. Toque no mapa para marcar.'
            : 'Não conseguimos achar sua localização agora. Toque no mapa para marcar.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected async criar(): Promise<void> {
    this.erroGeral.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { titulo, descricao, local, data, posicao } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      const encontro = await this.encontrosService.criar({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        local: local.trim(),
        posicao: posicao!,
        data: new Date(data).toISOString(),
      });
      await this.router.navigate(['/encontros', encontro.id]);
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível criar o encontro agora. Tente novamente.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }

  private erroObrigatorio(campo: 'titulo' | 'local', mensagem: string): string | null {
    this.formEvents();
    const controle = this.form.controls[campo];
    return controle.touched && controle.invalid ? mensagem : null;
  }
}
