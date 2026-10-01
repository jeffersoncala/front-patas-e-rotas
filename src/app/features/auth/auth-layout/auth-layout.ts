import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { Pata } from '../../../shared/pata/pata';

/** Números exibidos no painel de apresentação. */
const HERO_STATS = [
  { valor: '12 mil', label: 'passeios registrados' },
  { valor: '3,4 mil', label: 'encontros marcados' },
  { valor: '860', label: 'parques mapeados' },
] as const;

/**
 * Layout de duas colunas das telas de autenticação: painel laranja de
 * apresentação à esquerda e o formulário (projetado) com a marca à direita.
 *
 * Sem encapsulamento para que as classes `.auth__form`, `.auth__row` e
 * `.auth__rodape` também estilizem o conteúdo projetado pelas telas.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [Pata],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'auth' },
})
export class AuthLayout {
  readonly heroTitulo = input.required<string>();
  readonly heroTexto = input.required<string>();
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();

  protected readonly patas = [1, 2, 3, 4, 5, 6];
  protected readonly stats = HERO_STATS;
}
