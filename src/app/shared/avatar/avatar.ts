import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { urlFoto } from '../../core/api';

/**
 * Foto redonda do tutor ou do pet, ou a inicial do nome quando não há foto (ou ela não carrega).
 * Preenche o elemento em volta, que define tamanho, cor e formato.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (src(); as src) {
      <img [src]="src" alt="" (error)="falhou.set(true)" />
    } @else {
      {{ inicial() }}
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class Avatar {
  /** Caminho da foto na API, como vem nos modelos, ou um data URL de pré-visualização. */
  readonly foto = input<string | null | undefined>(null);
  readonly nome = input<string | null | undefined>('');

  /** Volta a tentar quando a foto muda. */
  protected readonly falhou = linkedSignal({ source: this.foto, computation: () => false });
  protected readonly src = computed(() => {
    const foto = this.foto();
    if (this.falhou() || !foto) return null;
    return foto.startsWith('data:') ? foto : urlFoto(foto);
  });
  protected readonly inicial = computed(() => this.nome()?.trim()[0]?.toUpperCase() ?? '?');
}
