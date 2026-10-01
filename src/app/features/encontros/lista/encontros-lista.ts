import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EncontrosService } from '../../../core/encontros.service';
import { formatarHora, partesData } from '../../../core/formato';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

type Filtro = 'todos' | 'vou';

const FILTROS: readonly { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'vou', label: 'Vou' },
];

@Component({
  selector: 'app-encontros-lista',
  imports: [RouterLink, Mapa],
  templateUrl: './encontros-lista.html',
  styleUrl: './encontros-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncontrosLista {
  private readonly encontrosService = inject(EncontrosService);

  protected readonly filtros = FILTROS;
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly selecionado = signal<number | null>(null);

  protected readonly encontros = computed(() =>
    (this.filtro() === 'vou'
      ? this.encontrosService.confirmados()
      : this.encontrosService.encontros()
    ).map((e) => ({ ...e, ...partesData(e.data), hora: formatarHora(e.data) })),
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() =>
    this.encontros().map((e) => ({
      id: e.id,
      posicao: e.posicao,
      titulo: e.titulo,
      tipo: e.id === this.selecionado() ? 'destaque' : 'padrao',
    })),
  );

  constructor() {
    this.encontrosService.carregar();
  }

  protected escolherFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  protected selecionar(id: number): void {
    this.selecionado.set(id);
  }

  protected alternarPresenca(id: number): void {
    this.encontrosService.alternarPresenca(id);
  }

  /** Clique no pino do mapa: destaca e leva o item correspondente para a vista. */
  protected aoClicarMarcador(id: MarcadorMapa['id']): void {
    const encontroId = Number(id);
    this.selecionado.set(encontroId);
    document
      .getElementById(`encontro-${encontroId}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
}
