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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro, urlFoto } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import {
  formatarPreco,
  linksTelefone,
  paraDatetimeLocal,
  tempoRelativo,
} from '../../../core/formato';
import { Avaliacao, Prestador, rotuloServico } from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Avatar } from '../../../shared/avatar/avatar';
import { Estrelas } from '../../../shared/estrelas/estrelas';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

/** O início do serviço (valor de um datetime-local) não pode estar no passado. */
function noFuturo(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
  const data = new Date(control.value).getTime();
  if (Number.isNaN(data)) return { dataInvalida: true };
  return data >= Date.now() - 60_000 ? null : { passado: true };
}

/** Perfil público do prestador: fotos, preços, avaliações e o pedido do serviço. */
@Component({
  selector: 'app-prestador-detalhe',
  imports: [ReactiveFormsModule, RouterLink, Avatar, Estrelas, Mapa],
  templateUrl: './prestador-detalhe.html',
  styleUrl: './prestador-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrestadorDetalhe {
  private readonly router = inject(Router);
  private readonly service = inject(ServicosService);
  private readonly auth = inject(AuthService);

  /** Vem do parâmetro `:id` da URL. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly formatarPreco = formatarPreco;
  protected readonly urlFoto = urlFoto;
  protected readonly tempoRelativo = tempoRelativo;
  protected readonly agora = paraDatetimeLocal(new Date());

  protected readonly prestador = signal<Prestador | null>(null);
  protected readonly avaliacoes = signal<Avaliacao[]>([]);
  protected readonly naoEncontrado = signal(false);
  protected readonly pets = computed(() => this.auth.perfil()?.pets ?? []);
  protected readonly petsEscolhidos = signal<ReadonlySet<number>>(new Set());

  protected readonly tipoLabel = computed(() => {
    const p = this.prestador();
    return p ? rotuloServico(p.tipo) : '';
  });
  protected readonly hospedagem = computed(() => this.prestador()?.tipo === 'anfitriao');
  protected readonly telefone = computed(() => {
    const p = this.prestador();
    return p ? linksTelefone(p.contato) : null;
  });
  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const p = this.prestador();
    return p ? [{ id: p.id, posicao: p.posicao, titulo: p.bairro, tipo: 'destaque' }] : [];
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    inicio: ['', [Validators.required, noFuturo]],
    fim: [''],
    contato: ['', [Validators.required, Validators.pattern(/\S/)]],
    mensagem: ['', Validators.maxLength(1000)],
  });

  /** Sem zone.js: os eventos do formulário viram signal para recalcular os erros. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly enviando = signal(false);
  protected readonly erroPedido = signal<string | null>(null);
  protected readonly tentouEnviar = signal(false);

  protected readonly inicioErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.inicio;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Quando o serviço deve começar?';
    if (c.hasError('passado')) return 'Escolha uma data a partir de agora.';
    return 'Essa data não parece válida.';
  });

  protected readonly fimErro = computed(() => {
    this.formEvents();
    if (!this.hospedagem()) return null;
    const { inicio, fim } = this.form.controls;
    if (!fim.touched) return null;
    if (!fim.value) return 'Até quando o pet fica hospedado?';
    if (inicio.value && new Date(fim.value) <= new Date(inicio.value)) {
      return 'O fim deve ser depois do início.';
    }
    return null;
  });

  protected readonly contatoErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.contato;
    return c.touched && c.invalid ? 'Deixe um telefone para combinar os detalhes.' : null;
  });

  protected readonly petsErro = computed(() =>
    this.tentouEnviar() && !this.petsEscolhidos().size ? 'Escolha pelo menos um pet.' : null,
  );

  constructor() {
    effect(() => this.carregar(this.id()));
    // Com um pet só, ele já vem marcado.
    effect(() => {
      const pets = this.pets();
      if (pets.length === 1) this.petsEscolhidos.set(new Set([pets[0].id]));
    });
  }

  protected alternarPet(id: number): void {
    this.petsEscolhidos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  protected async pedir(): Promise<void> {
    const prestador = this.prestador();
    if (!prestador) return;
    this.erroPedido.set(null);
    this.tentouEnviar.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.fimErro() || !this.petsEscolhidos().size) return;

    const { inicio, fim, contato, mensagem } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      await this.service.contratar({
        prestadorId: prestador.id,
        petIds: [...this.petsEscolhidos()],
        inicio: new Date(inicio).toISOString(),
        ...(this.hospedagem() && { fim: new Date(fim).toISOString() }),
        contato: contato.trim(),
        mensagem: mensagem.trim(),
      });
      await this.router.navigate(['/servicos/pedidos']);
    } catch (erro) {
      this.erroPedido.set(
        mensagemDeErro(erro, 'Não foi possível enviar o pedido agora. Tente novamente.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }

  private async carregar(id: number): Promise<void> {
    this.naoEncontrado.set(false);
    try {
      const [prestador, avaliacoes] = await Promise.all([
        this.service.buscar(id),
        this.service.avaliacoes(id),
      ]);
      this.prestador.set(prestador);
      this.avaliacoes.set(avaliacoes);
    } catch {
      this.naoEncontrado.set(true);
    }
  }
}
