import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

/** Provedores de login social oferecidos na tela. */
const SOCIAL_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
] as const;

type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]['id'];

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly router = inject(Router);

  protected readonly providers = SOCIAL_PROVIDERS;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    lembrarMe: [true],
  });

  /**
   * O app roda sem zone.js, então acompanhamos os eventos do formulário por um
   * signal para que os erros no template sejam recalculados a cada digitação.
   */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly emailErro = computed(() => {
    this.formEvents();
    const email = this.form.controls.email;
    if (!email.touched || email.valid) {
      return null;
    }
    return email.hasError('required')
      ? 'Informe o e-mail da sua conta.'
      : 'Esse e-mail não parece válido.';
  });

  protected readonly senhaErro = computed(() => {
    this.formEvents();
    const senha = this.form.controls.senha;
    if (!senha.touched || senha.valid) {
      return null;
    }
    return senha.hasError('required')
      ? 'Informe sua senha.'
      : 'A senha precisa ter ao menos 6 caracteres.';
  });

  protected alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected async entrar(): Promise<void> {
    this.erroGeral.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    try {
      // TODO: trocar pela chamada real ao AuthService quando a API estiver pronta.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await this.router.navigateByUrl('/');
    } catch {
      this.erroGeral.set('Não foi possível entrar agora. Tente novamente em instantes.');
    } finally {
      this.enviando.set(false);
    }
  }

  protected entrarCom(provider: SocialProvider): void {
    // TODO: integrar o fluxo OAuth de cada provedor.
    this.erroGeral.set(`Login com ${provider} ainda está a caminho. Use seu e-mail por enquanto.`);
  }
}
