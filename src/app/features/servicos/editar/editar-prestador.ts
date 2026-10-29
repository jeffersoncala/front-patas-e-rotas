import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import { formatarPreco, lerPreco } from '../../../core/formato';
import { CENTRO_PADRAO, FalhaLocalizacao, localizar } from '../../../core/geo';
import { LatLng, Prestador, TIPOS_SERVICO, TipoServico } from '../../../core/models';
import { MAX_FOTOS_PRESTADOR, ServicosService } from '../../../core/servicos.service';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';
import { SeletorFotos } from '../../../shared/seletor-fotos/seletor-fotos';

const MAX_PRECOS = 10;

/** Exemplos do que cobrar, para o prestador não começar do zero. */
const PRECO_EXEMPLO: Record<TipoServico, string> = {
  passeador: 'Ex.: Passeio de 30 min',
  anfitriao: 'Ex.: Diária',
  petshop: 'Ex.: Banho porte P',
};

const DESCRICAO_EXEMPLO: Record<TipoServico, string> = {
  passeador: 'Quantos cães leva por vez, horários, se aceita filhotes…',
  anfitriao: 'Como é o espaço, se tem quintal e outros pets, rotina com os hóspedes…',
  petshop: 'Serviços oferecidos, produtos usados, se busca e leva o pet…',
};

const AVISOS_LOCALIZACAO: Record<FalhaLocalizacao, string> = {
  indisponivel: 'Seu navegador não informa a localização. Toque no mapa para marcar.',
  negada: 'Sem permissão para usar sua localização. Toque no mapa para marcar.',
  falhou: 'Não conseguimos achar sua localização agora. Toque no mapa para marcar.',
};

type LinhaPreco = { descricao: FormControl<string>; valor: FormControl<string> };

/**
 * Cadastro e edição de um serviço oferecido. Sem `id` na rota, cria (o tipo pode vir em
 * `?tipo=`); com `id`, edita, e o tipo não muda mais.
 */
@Component({
  selector: 'app-editar-prestador',
  imports: [ReactiveFormsModule, RouterLink, Mapa, SeletorFotos],
  templateUrl: './editar-prestador.html',
  styleUrl: './editar-prestador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditarPrestador {
  private readonly router = inject(Router);
  private readonly service = inject(ServicosService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  /** Parâmetro `:id` da URL, na edição. */
  readonly id = input<number | undefined, string | undefined>(undefined, {
    transform: (v) => (v ? Number(v) : undefined),
  });
  /** Query `?tipo=`, na criação. */
  readonly tipoInicial = input<TipoServico | undefined>(undefined, { alias: 'tipo' });

  protected readonly tipos = TIPOS_SERVICO;
  protected readonly maxFotos = MAX_FOTOS_PRESTADOR;
  protected readonly maxPrecos = MAX_PRECOS;
  protected readonly editando = computed(() => this.id() !== undefined);
  protected readonly carregado = signal<Prestador | null>(null);
  protected readonly naoEncontrado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    tipo: ['passeador' as TipoServico],
    nome: [this.auth.perfil()?.tutor ?? '', [Validators.required, Validators.pattern(/\S/)]],
    descricao: ['', Validators.maxLength(1000)],
    contato: ['', [Validators.required, Validators.pattern(/\S/)]],
    bairro: ['', [Validators.required, Validators.pattern(/\S/)]],
    posicao: new FormControl<LatLng | null>(null, Validators.required),
    precos: this.fb.array<FormGroup<LinhaPreco>>([]),
  });

  /** Caminhos das que o serviço já tem e data URLs das novas, na ordem. */
  protected readonly fotos = signal<string[]>([]);
  protected readonly preparandoFotos = signal(false);
  protected readonly minhaPosicao = signal<LatLng | null>(null);
  protected readonly localizando = signal(false);
  protected readonly erroLocalizacao = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  /** Sem zone.js: os eventos do formulário viram signal para recalcular erros e mapa. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly tipo = computed(() => {
    this.formEvents();
    return this.form.controls.tipo.value;
  });
  protected readonly precoExemplo = computed(() => PRECO_EXEMPLO[this.tipo()]);
  protected readonly descricaoExemplo = computed(() => DESCRICAO_EXEMPLO[this.tipo()]);

  protected readonly posicao = computed(() => {
    this.formEvents();
    return this.form.controls.posicao.value;
  });
  protected readonly centro = computed<LatLng>(
    () => this.posicao() ?? this.minhaPosicao() ?? CENTRO_PADRAO,
  );
  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const posicao = this.posicao();
    return posicao
      ? [{ id: 'regiao', posicao, titulo: 'Região de atendimento', tipo: 'destaque' }]
      : [];
  });

  protected readonly erros = computed(() => {
    this.formEvents();
    const c = this.form.controls;
    const erro = (campo: 'nome' | 'contato' | 'bairro' | 'posicao', mensagem: string) =>
      c[campo].touched && c[campo].invalid ? mensagem : null;
    return {
      nome: erro('nome', 'Como você quer aparecer na busca?'),
      contato: erro('contato', 'Deixe um telefone para os tutores falarem com você.'),
      bairro: erro('bairro', 'Em que bairro você atende?'),
      posicao: erro('posicao', 'Toque no mapa para marcar a região onde você atende.'),
      precos: c.precos.controls.map((linha) => ({
        descricao:
          linha.controls.descricao.touched && linha.controls.descricao.invalid
            ? 'Descreva o que está sendo cobrado.'
            : null,
        valor:
          linha.controls.valor.touched && linha.controls.valor.invalid
            ? 'Use um valor como 25 ou 25,50.'
            : null,
      })),
    };
  });

  constructor() {
    effect(() => {
      const tipo = this.tipoInicial();
      if (tipo && TIPOS_SERVICO.some((t) => t.id === tipo)) {
        untracked(() => this.form.controls.tipo.setValue(tipo));
      }
    });
    effect(() => {
      const id = this.id();
      if (id !== undefined) untracked(() => this.carregar(id));
    });
  }

  protected adicionarPreco(): void {
    this.form.controls.precos.push(this.novaLinhaPreco());
  }

  protected removerPreco(indice: number): void {
    this.form.controls.precos.removeAt(indice);
  }

  protected escolherPosicao(posicao: LatLng): void {
    const controle = this.form.controls.posicao;
    controle.setValue(posicao);
    controle.markAsTouched();
  }

  protected async usarMinhaLocalizacao(): Promise<void> {
    this.erroLocalizacao.set(null);
    this.localizando.set(true);
    try {
      const posicao = await localizar();
      this.minhaPosicao.set(posicao);
      this.escolherPosicao(posicao);
    } catch (falha) {
      this.erroLocalizacao.set(
        AVISOS_LOCALIZACAO[falha as FalhaLocalizacao] ?? AVISOS_LOCALIZACAO.falhou,
      );
    } finally {
      this.localizando.set(false);
    }
  }

  protected async salvar(): Promise<void> {
    this.erroGeral.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tipo, nome, descricao, contato, bairro, posicao, precos } = this.form.getRawValue();
    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      contato: contato.trim(),
      bairro: bairro.trim(),
      posicao: posicao!,
      precos: precos.map((p) => ({
        descricao: p.descricao.trim(),
        valorCentavos: lerPreco(p.valor)!,
      })),
      fotos: this.fotos(),
    };

    this.enviando.set(true);
    try {
      const id = this.id();
      const salvo =
        id === undefined
          ? await this.service.criar({ ...dados, tipo })
          : await this.service.alterar(id, dados);
      await this.router.navigate(['/servicos', salvo.id]);
    } catch (erro) {
      this.erroGeral.set(mensagemDeErro(erro, 'Não foi possível salvar agora. Tente novamente.'));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async apagar(): Promise<void> {
    const id = this.id();
    if (id === undefined) return;
    if (
      !confirm(
        'Apagar este serviço? Os pedidos e as avaliações dele também somem. Para parar só por um tempo, use "Pausar".',
      )
    ) {
      return;
    }
    this.erroGeral.set(null);
    try {
      await this.service.apagar(id);
      await this.router.navigate(['/servicos/meus']);
    } catch (erro) {
      this.erroGeral.set(mensagemDeErro(erro, 'Não foi possível apagar agora. Tente novamente.'));
    }
  }

  private novaLinhaPreco(descricao = '', valor = '') {
    return this.fb.nonNullable.group<LinhaPreco>({
      descricao: this.fb.nonNullable.control(descricao, [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(60),
      ]),
      valor: this.fb.nonNullable.control(valor, [
        Validators.required,
        (c) => (lerPreco(c.value) === null ? { valor: true } : null),
      ]),
    });
  }

  private async carregar(id: number): Promise<void> {
    try {
      const p = await this.service.buscar(id);
      if (!p.meu) {
        this.naoEncontrado.set(true);
        return;
      }
      this.carregado.set(p);
      this.form.patchValue({
        tipo: p.tipo,
        nome: p.nome,
        descricao: p.descricao,
        contato: p.contato,
        bairro: p.bairro,
        posicao: p.posicao,
      });
      this.form.controls.precos.clear();
      for (const preco of p.precos) {
        this.form.controls.precos.push(
          // "R$ 25,00" -> "25,00", que o campo aceita de volta.
          this.novaLinhaPreco(
            preco.descricao,
            formatarPreco(preco.valorCentavos).replace(/[^\d,.]/g, ''),
          ),
        );
      }
      this.fotos.set(p.fotos);
    } catch {
      this.naoEncontrado.set(true);
    }
  }
}
