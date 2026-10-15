import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { formatarDuracao, formatarKm, tempoRelativo } from '../../core/formato';
import { REDUZIR_IMAGEM, TIPOS_ACEITOS } from '../../core/imagem';
import { ESPECIES, Especie, PORTES, Pet, Porte, nomesPets } from '../../core/models';
import { PasseiosService } from '../../core/passeios.service';
import { Avatar } from '../../shared/avatar/avatar';
import { FotosPasseio } from '../../shared/fotos-passeio/fotos-passeio';
import { Mapa, TrajetoMapa } from '../../shared/mapa/mapa';

/** De quem é a foto sendo trocada: do tutor ou de um pet (pelo id). */
type AlvoFoto = 'tutor' | number;

/** Só espaços conta como vazio (a API apara o texto). */
const naoVazio = Validators.pattern(/\S/);

@Component({
  selector: 'app-meu-perfil',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, Avatar, FotosPasseio, Mapa],
  templateUrl: './meu-perfil.html',
  styleUrl: './meu-perfil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeuPerfil {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly passeiosService = inject(PasseiosService);
  private readonly reduzirImagem = inject(REDUZIR_IMAGEM);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly perfil = this.auth.perfil;
  protected readonly meusPasseios = this.passeiosService.meus;
  protected readonly kmTotal = this.passeiosService.kmTotal;
  protected readonly totalPasseios = this.passeiosService.totalPasseios;
  protected readonly encontrosConfirmados = this.passeiosService.encontrosConfirmados;
  protected readonly especies = ESPECIES;
  protected readonly portes = PORTES;
  protected readonly tiposAceitos = TIPOS_ACEITOS;
  protected readonly nomesPets = nomesPets;

  /** Passeio escolhido na lista fica em destaque no mapa. */
  protected readonly selecionado = signal<number | null>(null);
  protected readonly trajetos = computed<TrajetoMapa[]>(() =>
    this.meusPasseios().map((p) => ({
      id: p.id,
      pontos: p.pontos,
      destaque: p.id === this.selecionado(),
    })),
  );

  /** Erro da última ação (foto, salvar, remover), mostrado no topo. */
  protected readonly erro = signal<string | null>(null);

  // --- Tutor -----------------------------------------------------------------
  protected readonly editandoTutor = signal(false);
  protected readonly salvandoTutor = signal(false);

  protected readonly formTutor = this.fb.group({
    tutor: ['', [Validators.required, naoVazio, Validators.maxLength(80)]],
    metaSemanalKm: [15, [Validators.required, Validators.min(1), Validators.max(200)]],
  });

  private readonly eventosTutor = toSignal(this.formTutor.events);

  protected readonly tutorErro = computed(() => {
    this.eventosTutor();
    const c = this.formTutor.controls.tutor;
    return c.touched && c.invalid ? 'Informe seu nome.' : null;
  });

  protected readonly metaErro = computed(() => {
    this.eventosTutor();
    const c = this.formTutor.controls.metaSemanalKm;
    return c.touched && c.invalid ? 'A meta deve ficar entre 1 e 200 km.' : null;
  });

  // --- Pets ------------------------------------------------------------------
  /** Pet com o formulário aberto: o id, `'novo'` ao adicionar, ou nenhum. */
  protected readonly editandoPet = signal<number | 'novo' | null>(null);
  protected readonly salvandoPet = signal(false);
  /** Pet aguardando a confirmação da remoção. */
  protected readonly removendoPet = signal<number | null>(null);

  protected readonly formPet = this.fb.group({
    nome: ['', [Validators.required, naoVazio, Validators.maxLength(60)]],
    especie: this.fb.control<Especie>('cachorro'),
    raca: ['', Validators.maxLength(60)],
    idadeAnos: [1, [Validators.required, Validators.min(0), Validators.max(40)]],
    porte: this.fb.control<Porte>('medio'),
    bio: ['', Validators.maxLength(200)],
  });

  private readonly eventosPet = toSignal(this.formPet.events);

  protected readonly nomePetErro = computed(() => {
    this.eventosPet();
    const c = this.formPet.controls.nome;
    return c.touched && c.invalid ? 'Informe o nome do pet.' : null;
  });

  protected readonly idadeErro = computed(() => {
    this.eventosPet();
    const c = this.formPet.controls.idadeAnos;
    return c.touched && c.invalid ? 'Informe uma idade entre 0 e 40 anos.' : null;
  });

  // --- Fotos -----------------------------------------------------------------
  private alvoFoto: AlvoFoto = 'tutor';
  /** Foto sendo enviada, para mostrar o progresso no lugar certo. */
  protected readonly enviandoFoto = signal<AlvoFoto | null>(null);

  protected readonly formatarKm = formatarKm;
  protected readonly formatarDuracao = formatarDuracao;
  protected readonly tempoRelativo = tempoRelativo;

  constructor() {
    this.passeiosService.carregar();
  }

  protected descricaoPet(pet: Pet): string {
    const especie = ESPECIES.find((e) => e.id === pet.especie)?.label ?? '';
    const porte = PORTES.find((p) => p.id === pet.porte)?.label.toLowerCase() ?? '';
    const idade = `${pet.idadeAnos} ${pet.idadeAnos === 1 ? 'ano' : 'anos'}`;
    return [especie, pet.raca, idade, `porte ${porte}`].filter(Boolean).join(' · ');
  }

  // --- Tutor -----------------------------------------------------------------
  protected editarTutor(): void {
    const perfil = this.perfil();
    if (!perfil) return;
    this.formTutor.reset({ tutor: perfil.tutor, metaSemanalKm: perfil.metaSemanalKm });
    this.erro.set(null);
    this.editandoTutor.set(true);
  }

  protected cancelarTutor(): void {
    this.editandoTutor.set(false);
  }

  protected async salvarTutor(): Promise<void> {
    if (this.formTutor.invalid) {
      this.formTutor.markAllAsTouched();
      return;
    }
    const { tutor, metaSemanalKm } = this.formTutor.getRawValue();
    const ok = await this.executar(this.salvandoTutor, 'Não foi possível salvar agora.', () =>
      this.auth.atualizarPerfil({ tutor: tutor.trim(), metaSemanalKm }),
    );
    if (ok) this.editandoTutor.set(false);
  }

  // --- Pets ------------------------------------------------------------------
  protected novoPet(): void {
    this.formPet.reset({
      nome: '',
      especie: 'cachorro',
      raca: '',
      idadeAnos: 1,
      porte: 'medio',
      bio: '',
    });
    this.abrirFormPet('novo');
  }

  protected editarPet(pet: Pet): void {
    const { id, foto, ...dados } = pet;
    this.formPet.reset(dados);
    this.abrirFormPet(id);
  }

  private abrirFormPet(alvo: number | 'novo'): void {
    this.erro.set(null);
    this.removendoPet.set(null);
    this.editandoPet.set(alvo);
  }

  protected cancelarPet(): void {
    this.editandoPet.set(null);
  }

  protected async salvarPet(): Promise<void> {
    const alvo = this.editandoPet();
    if (alvo === null) return;
    if (this.formPet.invalid) {
      this.formPet.markAllAsTouched();
      return;
    }
    const valor = this.formPet.getRawValue();
    const dados = {
      ...valor,
      nome: valor.nome.trim(),
      raca: valor.raca.trim(),
      bio: valor.bio.trim(),
    };
    const ok = await this.executar(this.salvandoPet, 'Não foi possível salvar o pet agora.', () =>
      alvo === 'novo' ? this.auth.adicionarPet(dados) : this.auth.atualizarPet(alvo, dados),
    );
    if (ok) this.editandoPet.set(null);
  }

  protected pedirRemocao(id: number): void {
    this.erro.set(null);
    this.removendoPet.set(id);
  }

  protected cancelarRemocao(): void {
    this.removendoPet.set(null);
  }

  protected async removerPet(id: number): Promise<void> {
    await this.executar(this.salvandoPet, 'Não foi possível remover o pet agora.', () =>
      this.auth.removerPet(id),
    );
    this.removendoPet.set(null);
  }

  // --- Fotos -----------------------------------------------------------------
  /** Abre o seletor de arquivos para a foto do tutor ou de um pet. */
  protected escolherFoto(alvo: AlvoFoto, seletor: HTMLInputElement): void {
    this.alvoFoto = alvo;
    this.erro.set(null);
    seletor.click();
  }

  protected async fotoEscolhida(seletor: HTMLInputElement): Promise<void> {
    const arquivo = seletor.files?.[0];
    // Limpa para que escolher o mesmo arquivo de novo também dispare o `change`.
    seletor.value = '';
    if (!arquivo) return;

    const alvo = this.alvoFoto;
    this.enviandoFoto.set(alvo);
    try {
      const imagem = await this.reduzirImagem(arquivo);
      await (alvo === 'tutor'
        ? this.auth.trocarFoto(imagem)
        : this.auth.trocarFotoPet(alvo, imagem));
    } catch (erro) {
      // Erros da redução (arquivo que não é imagem) já vêm com a mensagem para o tutor.
      this.erro.set(
        erro instanceof Error
          ? erro.message
          : mensagemDeErro(erro, 'Não foi possível enviar a foto agora. Tente novamente.'),
      );
    } finally {
      this.enviandoFoto.set(null);
    }
  }

  protected async removerFoto(alvo: AlvoFoto): Promise<void> {
    this.erro.set(null);
    this.enviandoFoto.set(alvo);
    try {
      await (alvo === 'tutor' ? this.auth.removerFoto() : this.auth.removerFotoPet(alvo));
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível remover a foto agora.'));
    } finally {
      this.enviandoFoto.set(null);
    }
  }

  // --- Outros ----------------------------------------------------------------
  protected selecionar(id: number): void {
    this.selecionado.update((atual) => (atual === id ? null : id));
  }

  protected async sair(): Promise<void> {
    this.auth.sair();
    await this.router.navigateByUrl('/login');
  }

  /** Roda a ação marcando `ocupado`; em caso de erro mostra a mensagem e devolve `false`. */
  private async executar(
    ocupado: WritableSignal<boolean>,
    padrao: string,
    acao: () => Promise<void>,
  ): Promise<boolean> {
    this.erro.set(null);
    ocupado.set(true);
    try {
      await acao();
      return true;
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, padrao));
      return false;
    } finally {
      ocupado.set(false);
    }
  }
}
