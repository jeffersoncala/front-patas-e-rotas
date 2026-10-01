import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { AuthService } from '../../../core/auth.service';
import { ESPECIES, Especie, PORTES, Porte } from '../../../core/models';
import { AuthLayout } from '../auth-layout/auth-layout';

/** Teclas que movem a seleção dentro de um grupo `role="radiogroup"`. */
const PASSOS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

type Campo = 'tutor' | 'email' | 'senha' | 'pet' | 'especie' | 'porte' | 'termos';

@Component({
  selector: 'app-cadastro',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cadastro {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly especies = ESPECIES;
  protected readonly portes = PORTES;

  protected readonly form = this.fb.group({
    tutor: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]],
    pet: ['', [Validators.required]],
    especie: this.fb.control<Especie | null>(null, Validators.required),
    porte: this.fb.control<Porte | null>(null, Validators.required),
    termos: [false, [Validators.requiredTrue]],
  });

  /** Sem zone.js: os erros são recalculados a partir dos eventos do formulário. */
  private readonly formEvents = toSignal(this.form.events);

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);

  protected readonly especie = computed(() => {
    this.formEvents();
    return this.form.controls.especie.value;
  });

  protected readonly porte = computed(() => {
    this.formEvents();
    return this.form.controls.porte.value;
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

  protected readonly petErro = computed(() =>
    this.erro('pet', { required: 'Qual é o nome do seu pet?' }),
  );

  protected readonly especieErro = computed(() =>
    this.erro('especie', { required: 'Escolha a espécie do pet.' }),
  );

  protected readonly porteErro = computed(() =>
    this.erro('porte', { required: 'Escolha o porte do pet.' }),
  );

  protected readonly termosErro = computed(() =>
    this.erro('termos', { required: 'É preciso aceitar os termos para continuar.' }),
  );

  protected alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected escolherEspecie(valor: Especie): void {
    this.form.controls.especie.setValue(valor);
    this.form.controls.especie.markAsTouched();
  }

  protected escolherPorte(valor: Porte): void {
    this.form.controls.porte.setValue(valor);
    this.form.controls.porte.markAsTouched();
  }

  /** Setas do teclado movem foco e seleção entre as opções do grupo. */
  protected moverEscolha(evento: KeyboardEvent): void {
    const passo = PASSOS[evento.key];
    if (!passo) return;
    evento.preventDefault();

    const grupo = evento.currentTarget as HTMLElement;
    const opcoes = Array.from(grupo.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const atual = opcoes.indexOf(evento.target as HTMLButtonElement);
    const proxima = opcoes[(atual + passo + opcoes.length) % opcoes.length];
    proxima.click();
    proxima.focus();
  }

  protected async cadastrar(): Promise<void> {
    this.erroGeral.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { tutor, email, senha, pet, especie, porte } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      await this.auth.cadastrar({ tutor, email, senha, pet, especie: especie!, porte: porte! });
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
