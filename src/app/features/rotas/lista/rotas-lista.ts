import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatarDuracao, formatarKm } from '../../../core/formato';
import { Rota } from '../../../core/models';
import { RotasService } from '../../../core/rotas.service';
import { Mapa, MarcadorMapa, TrajetoMapa } from '../../../shared/mapa/mapa';

type Filtro = 'todas' | 'favoritas';

const FILTROS: readonly { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'favoritas', label: 'Favoritas' },
];

@Component({
  selector: 'app-rotas-lista',
  imports: [RouterLink, Mapa],
  templateUrl: './rotas-lista.html',
  styleUrl: './rotas-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotasLista {
  private readonly rotasService = inject(RotasService);

  protected readonly filtros = FILTROS;
  protected readonly formatarKm = formatarKm;
  protected readonly formatarDuracao = formatarDuracao;

  protected readonly filtro = signal<Filtro>('todas');
  /** Rota escolhida com clique na lista ou no mapa. */
  protected readonly selecionadaId = signal<number | null>(null);
  /** Rota sob o ponteiro/foco, que tem prioridade no destaque do mapa. */
  protected readonly hoverId = signal<number | null>(null);

  protected readonly rotas = computed(() =>
    this.filtro() === 'favoritas' ? this.rotasService.favoritas() : this.rotasService.rotas(),
  );

  private readonly destacadaId = computed(() => this.hoverId() ?? this.selecionadaId());

  protected readonly selecionada = computed<Rota | undefined>(() =>
    this.rotas().find((r) => r.id === this.destacadaId()),
  );

  protected readonly trajetos = computed<TrajetoMapa[]>(() =>
    this.rotas().map((r) => ({
      id: r.id,
      pontos: r.pontos,
      destaque: r.id === this.destacadaId(),
    })),
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const rota = this.selecionada();
    return rota?.pontos.length
      ? [{ id: rota.id, posicao: rota.pontos[0], titulo: `Início: ${rota.nome}`, tipo: 'destaque' }]
      : [];
  });

  constructor() {
    this.rotasService.carregar();
  }

  protected filtrar(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  protected selecionar(id: number): void {
    this.selecionadaId.set(id);
  }

  protected alternarFavorita(id: number): void {
    this.rotasService.alternarFavorita(id);
  }
}
