import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Nota de 1 a 5 em estrelas, com o número ao lado: "★★★★☆ 4,5 (12)". Sem avaliações,
 * mostra "Novo". O texto lido pelo leitor de tela é a frase completa.
 */
@Component({
  selector: 'app-estrelas',
  template: `
    @if (nota(); as nota) {
      <span class="estrelas" aria-hidden="true">
        @for (cheia of preenchidas(); track $index) {
          <span [class.vazia]="!cheia">★</span>
        }
      </span>
      <span aria-hidden="true"
        >{{ formatada() }}
        @if (total() !== null) {
          <span class="total">({{ total() }})</span>
        }
      </span>
      <span class="sr-only">{{ descricao() }}</span>
    } @else {
      <span class="novo">Novo</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 0.35rem;
      align-items: center;
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--ink-700);
    }

    .estrelas {
      letter-spacing: 0.05em;
      color: #f5a623;
    }

    .vazia {
      color: var(--ink-300);
    }

    .total {
      font-weight: 400;
      color: var(--ink-500);
    }

    .novo {
      padding: 0.1rem 0.5rem;
      font-size: 0.75rem;
      color: var(--accent-600);
      background: var(--accent-100);
      border-radius: var(--radius-pill);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Estrelas {
  /** De 1 a 5; null quando ainda não há avaliações. */
  readonly nota = input.required<number | null>();
  /** Quantas avaliações; null para não mostrar (ex.: numa avaliação só). */
  readonly total = input<number | null>(null);

  /** Arredonda para a estrela mais próxima: 4,5 mostra cinco. */
  protected readonly preenchidas = computed(() => {
    const cheias = Math.round(this.nota() ?? 0);
    return [1, 2, 3, 4, 5].map((i) => i <= cheias);
  });

  protected readonly formatada = computed(() =>
    (this.nota() ?? 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );

  protected readonly descricao = computed(() => {
    const total = this.total();
    const base = `Nota ${this.formatada()} de 5`;
    if (total === null) return base;
    return `${base}, ${total} ${total === 1 ? 'avaliação' : 'avaliações'}`;
  });
}
