import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import { REDUZIR_IMAGEM, TIPOS_ACEITOS } from '../../../core/imagem';
import { Avatar } from '../../../shared/avatar/avatar';
import { AuthLayout } from '../auth-layout/auth-layout';

type Campo = 'tutor' | 'email' | 'senha' | 'termos';

/** Cadastro só do tutor; os pets entram depois, pelo perfil. */
@Component({
  selector: 'app-cadastro',
  imports: [ReactiveFormsModule, RouterLink, Avatar, AuthLayout],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cadastro {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly reduzirImagem = inject(REDUZIR_IMAGEM);

  protected readonly tiposAceitos = TIPOS_ACEITOS;

  protected readonly form = this.fb.group({
    tutor: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    termos: [false, [Validators.requiredTrue]],
  });

  /** Sem zone.js: os erros são recalculados a partir dos eventos do formulário. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  // --- Foto (opcional) -------------------------------------------------------
  /** Já reduzida, em data URL: serve de pré-visualização e vai assim para a API. */
  protected readonly foto = signal<string | null>(null);
  /** Foto sendo reduzida; o envio espera ela ficar pronta. */
  protected readonly preparandoFoto = signal(false);
  protected readonly erroFoto = signal<string | null>(null);

  /** Nome digitado, para a inicial no lugar da foto. */
  protected readonly nomeTutor = computed(() => {
    this.formEvents();
    return this.form.controls.tutor.value;
  });

  protected readonly tutorErro = computed(() =>
    this.erro('tutor', { required: 'Conte pra gente como você se chama.' }),
  );

  protected readonly emailErro = computed(() =>
    this.erro('email', {
      required: 'Informe um e-mail para a conta.',
      email: 'Esse e-mail não parece válido.',
    }),
  );

  protected readonly senhaErro = computed(() =>
    this.erro('senha', {
      required: 'Crie uma senha.',
      minlength: 'A senha precisa ter ao menos 6 caracteres.',
    }),
  );

  protected readonly termosErro = computed(() =>
    this.erro('termos', { required: 'É preciso aceitar os termos para continuar.' }),
  );

  protected alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected async fotoEscolhida(seletor: HTMLInputElement): Promise<void> {
    const arquivo = seletor.files?.[0];
    // Limpa para que escolher o mesmo arquivo de novo também dispare o `change`.
    seletor.value = '';
    if (!arquivo) return;

    this.erroFoto.set(null);
    this.preparandoFoto.set(true);
    try {
      this.foto.set(await this.reduzirImagem(arquivo));
    } catch (erro) {
      this.erroFoto.set(erro instanceof Error ? erro.message : 'Não conseguimos abrir essa imagem.');
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
    if (this.preparandoFoto()) return;

    const { tutor, email, senha } = this.form.getRawValue();
    const fotoTutor = this.foto();
    this.enviando.set(true);
    try {
      await this.auth.cadastrar({ tutor, email, senha, ...(fotoTutor && { fotoTutor }) });
      await this.router.navigateByUrl('/');
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível criar a conta agora. Tente novamente em instantes.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }

  /** Mensagem do primeiro erro do campo, só depois que ele foi tocado. */
  private erro(campo: Campo, mensagens: Record<string, string>): string | null {
    this.formEvents();
    const controle = this.form.controls[campo];
    if (!controle.touched || controle.valid) {
      return null;
    }
    const chave = Object.keys(mensagens).find((erro) => controle.hasError(erro));
    return chave ? mensagens[chave] : null;
  }
}
