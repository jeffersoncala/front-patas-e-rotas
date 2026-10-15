import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatarDuracao, formatarKm, tempoRelativo } from '../../../core/formato';
import { Passeio, nomesPets } from '../../../core/models';
import { PasseiosService } from '../../../core/passeios.service';
import { RotasService } from '../../../core/rotas.service';
import { FotosPasseio } from '../../../shared/fotos-passeio/fotos-passeio';
import { Mapa, MarcadorMapa, TrajetoMapa } from '../../../shared/mapa/mapa';

@Component({
  selector: 'app-rota-detalhe',
  imports: [RouterLink, FotosPasseio, Mapa],
  templateUrl: './rota-detalhe.html',
  styleUrl: './rota-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotaDetalhe {
  private readonly rotasService = inject(RotasService);
  private readonly passeiosService = inject(PasseiosService);

  /** Vem do parâmetro `:id` da URL. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly formatarKm = formatarKm;
  protected readonly formatarDuracao = formatarDuracao;
  protected readonly tempoRelativo = tempoRelativo;
  protected readonly nomesPets = nomesPets;

  protected readonly rota = computed(() => this.rotasService.porId(this.id()));
  protected readonly carregadas = this.rotasService.carregadas;

  protected readonly passeios = signal<Passeio[]>([]);
  protected readonly recentes = computed(() => this.passeios().slice(0, 5));

  protected readonly trajetos = computed<TrajetoMapa[]>(() => {
    const rota = this.rota();
    return rota ? [{ id: rota.id, pontos: rota.pontos, destaque: true }] : [];
  });

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const rota = this.rota();
    return rota?.pontos.length
      ? [{ id: 'inicio', posicao: rota.pontos[0], titulo: 'Início da rota', tipo: 'destaque' }]
      : [];
  });

  constructor() {
    this.rotasService.carregar();

    effect((aoTrocar) => {
      const assinatura = this.passeiosService.daRota(this.id()).subscribe({
        next: (passeios) => this.passeios.set(passeios),
        error: () => this.passeios.set([]),
      });
      aoTrocar(() => assinatura.unsubscribe());
    });
  }

  protected alternarFavorita(): void {
    this.rotasService.alternarFavorita(this.id());
  }
}
