import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import { AuthLayout } from '../auth-layout/auth-layout';

@Component({
  selector: 'app-recuperar-senha',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './recuperar-senha.html',
  styleUrl: './recuperar-senha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecuperarSenha {
  private readonly auth = inject(AuthService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /** Sem zone.js: os erros são recalculados a partir dos eventos do formulário. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  /** E-mail para o qual o link foi enviado; `null` enquanto o pedido não foi feito. */
  protected readonly enviadoPara = signal<string | null>(null);

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

  protected async enviar(): Promise<void> {
    this.erroGeral.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      await this.auth.recuperarSenha(email);
      this.enviadoPara.set(email);
    } catch (erro) {
      this.erroGeral.set(
        mensagemDeErro(erro, 'Não foi possível enviar o link agora. Tente novamente em instantes.'),
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
