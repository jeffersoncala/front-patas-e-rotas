import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { urlFoto } from '../../core/api';

/** Fotos de um passeio em grade; cada uma abre inteira em outra aba. Sem fotos, não mostra nada. */
@Component({
  selector: 'app-fotos-passeio',
  template: `
    @if (fotos().length) {
      <div class="fotos" [attr.data-quantidade]="fotos().length">
        @for (foto of fotos(); track foto) {
          <a [href]="urlFoto(foto)" target="_blank" rel="noopener">
            <img
              [src]="urlFoto(foto)"
              [alt]="'Foto ' + ($index + 1) + ' do passeio de ' + autor()"
              loading="lazy"
            />
          </a>
        }
      </div>
    }
  `,
  styleUrl: './fotos-passeio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FotosPasseio {
  /** Caminhos das fotos na API, como vêm no `Passeio`. */
  readonly fotos = input.required<string[]>();
  /** Quem passeou, para o texto alternativo (ex.: "Mel" ou "Ana"). */
  readonly autor = input.required<string>();

  protected readonly urlFoto = urlFoto;
}
