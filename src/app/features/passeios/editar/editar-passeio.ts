import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { formatarKm, tempoRelativo } from '../../../core/formato';
import { Passeio } from '../../../core/models';
import { PasseiosService } from '../../../core/passeios.service';
import { Mapa, TrajetoMapa } from '../../../shared/mapa/mapa';
import { SeletorFotos } from '../../../shared/seletor-fotos/seletor-fotos';

/** Altera o que dá para mudar depois do passeio: duração, texto e fotos. O trajeto fica. */
@Component({
  selector: 'app-editar-passeio',
  imports: [ReactiveFormsModule, RouterLink, Mapa, SeletorFotos],
  templateUrl: './editar-passeio.html',
  styleUrl: './editar-passeio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarPasseio {
  private readonly router = inject(Router);
  private readonly passeiosService = inject(PasseiosService);
  private readonly fb = inject(FormBuilder);

  /** Vem do parâmetro `:id` da URL. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly formatarKm = formatarKm;
  protected readonly tempoRelativo = tempoRelativo;

  protected readonly passeio = signal<Passeio | null>(null);
  protected readonly naoEncontrado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    duracaoMin: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(1440),
    ]),
    texto: ['', Validators.maxLength(500)],
  });

  /** Caminhos das que o passeio já tem e data URLs das novas, na ordem. */
  protected readonly fotos = signal<string[]>([]);
  protected readonly preparandoFotos = signal(false);

  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  /** Sem zone.js: os erros do template são recalculados a partir dos eventos do form. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly duracaoErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.duracaoMin;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Informe quanto tempo durou.';
    return c.hasError('min') ? 'A duração mínima é 1 minuto.' : 'A duração máxima é 24 horas.';
  });

  protected readonly trajetos = computed<TrajetoMapa[]>(() => {
    const passeio = this.passeio();
    return passeio ? [{ id: passeio.id, pontos: passeio.pontos, destaque: true }] : [];
  });

  constructor() {
    effect((aoTrocar) => {
      const assinatura = this.passeiosService.buscar(this.id()).subscribe({
        next: (passeio) => this.usar(passeio),
        error: () => this.naoEncontrado.set(true),
      });
      aoTrocar(() => assinatura.unsubscribe());
    });
  }

  private usar(passeio: Passeio): void {
    this.passeio.set(passeio);
    this.naoEncontrado.set(false);
    this.form.reset({ duracaoMin: passeio.duracaoMin, texto: passeio.texto });
    this.fotos.set(passeio.fotos);
  }

  protected async salvar(): Promise<void> {
    this.erroGeral.set(null);
    if (this.preparandoFotos()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    try {
      const { duracaoMin, texto } = this.form.getRawValue();
      await this.passeiosService.alterar(this.id(), {
        duracaoMin: duracaoMin ?? 1,
        texto: texto.trim(),
        fotos: this.fotos(),
      });
      await this.router.navigateByUrl('/perfil');
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível salvar o passeio agora. Tente novamente.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
