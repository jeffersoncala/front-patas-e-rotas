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
import { DesaparecidosService } from '../../../core/desaparecidos.service';
import { paraDatetimeLocal } from '../../../core/formato';
import { CENTRO_PADRAO, FalhaLocalizacao, localizar } from '../../../core/geo';
import { REDUZIR_IMAGEM, TIPOS_ACEITOS } from '../../../core/imagem';
import { ESPECIES, Especie, LatLng, PORTES, Porte } from '../../../core/models';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

/** Quando o pet foi visto (valor de um datetime-local) não pode estar no futuro. */
function noPassado(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
  const data = new Date(control.value).getTime();
  if (Number.isNaN(data)) return { dataInvalida: true };
  return data <= Date.now() ? null : { futuro: true };
}

const AVISOS_LOCALIZACAO: Record<FalhaLocalizacao, string> = {
  indisponivel: 'Seu navegador não informa a localização. Toque no mapa para marcar.',
  negada: 'Sem permissão para usar sua localização. Toque no mapa para marcar.',
  falhou: 'Não conseguimos achar sua localização agora. Toque no mapa para marcar.',
};

type CampoTexto = 'nome' | 'contato';

@Component({
  selector: 'app-novo-desaparecido',
  imports: [ReactiveFormsModule, RouterLink, Mapa],
  templateUrl: './novo-desaparecido.html',
  styleUrl: './novo-desaparecido.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoDesaparecido {
  private readonly router = inject(Router);
  private readonly service = inject(DesaparecidosService);
  private readonly reduzirImagem = inject(REDUZIR_IMAGEM);

  protected readonly especies = ESPECIES;
  protected readonly portes = PORTES;
  protected readonly tiposAceitos = TIPOS_ACEITOS;
  /** Até agora: o momento em que a tela abriu já serve de teto no seletor. */
  protected readonly dataMaxima = paraDatetimeLocal(new Date());

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nome: ['', [Validators.required, Validators.pattern(/\S/)]],
    especie: ['cachorro' as Especie],
    raca: [''],
    porte: ['medio' as Porte],
    descricao: [''],
    contato: ['', [Validators.required, Validators.pattern(/\S/)]],
    vistoEm: [this.dataMaxima, [Validators.required, noPassado]],
    posicao: new FormControl<LatLng | null>(null, Validators.required),
  });

  /** Sem zone.js: os eventos do formulário viram signal para recalcular erros e mapa. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly foto = signal<string | null>(null);
  protected readonly preparandoFoto = signal(false);
  protected readonly erroFoto = signal<string | null>(null);
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
      marcadores.push({ id: 'visto', posicao: escolhida, titulo: 'Visto aqui', tipo: 'destaque' });
    }
    return marcadores;
  });

  protected readonly nomeErro = computed(() => this.erroObrigatorio('nome', 'Qual o nome do pet?'));
  protected readonly contatoErro = computed(() =>
    this.erroObrigatorio('contato', 'Deixe um telefone ou outro jeito de falar com você.'),
  );

  protected readonly vistoEmErro = computed(() => {
    this.formEvents();
    const campo = this.form.controls.vistoEm;
    if (!campo.touched || campo.valid) return null;
    if (campo.hasError('required')) return 'Quando o pet foi visto pela última vez?';
    if (campo.hasError('futuro')) return 'A data não pode ser no futuro.';
    return 'Essa data não parece válida.';
  });

  protected readonly posicaoErro = computed(() => {
    this.formEvents();
    const posicao = this.form.controls.posicao;
    return posicao.touched && posicao.invalid
      ? 'Toque no mapa para marcar onde o pet foi visto.'
      : null;
  });

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

  protected async escolherFoto(seletor: HTMLInputElement): Promise<void> {
    const arquivo = seletor.files?.[0];
    // Limpa para que escolher o mesmo arquivo de novo também dispare o `change`.
    seletor.value = '';
    if (!arquivo) return;
    this.erroFoto.set(null);
    this.preparandoFoto.set(true);
    try {
      this.foto.set(await this.reduzirImagem(arquivo));
    } catch (erro) {
      this.erroFoto.set(
        erro instanceof Error ? erro.message : 'Não foi possível usar essa foto. Tente outra.',
      );
    } finally {
      this.preparandoFoto.set(false);
    }
  }

  protected removerFoto(): void {
    this.foto.set(null);
    this.erroFoto.set(null);
  }

  protected async cadastrar(): Promise<void> {
    this.erroGeral.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nome, raca, descricao, contato, vistoEm, posicao, ...resto } = this.form.getRawValue();
    const foto = this.foto();
    this.enviando.set(true);
    try {
      await this.service.criar({
        ...resto,
        nome: nome.trim(),
        raca: raca.trim(),
        descricao: descricao.trim(),
        contato: contato.trim(),
        posicao: posicao!,
        vistoEm: new Date(vistoEm).toISOString(),
        ...(foto && { foto }),
      });
      await this.router.navigate(['/desaparecidos']);
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível cadastrar agora. Tente novamente.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }

  private erroObrigatorio(campo: CampoTexto, mensagem: string): string | null {
    this.formEvents();
    const controle = this.form.controls[campo];
    return controle.touched && controle.invalid ? mensagem : null;
  }
}
