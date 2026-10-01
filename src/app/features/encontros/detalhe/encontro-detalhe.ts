import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EncontrosService } from '../../../core/encontros.service';
import { formatarDataHora } from '../../../core/formato';
import { linkComoChegar } from '../../../core/geo';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

@Component({
  selector: 'app-encontro-detalhe',
  imports: [RouterLink, Mapa],
  templateUrl: './encontro-detalhe.html',
  styleUrl: './encontro-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncontroDetalhe {
  private readonly encontrosService = inject(EncontrosService);

  /** Vem do `:id` da rota (withComponentInputBinding). */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly encontro = computed(() => this.encontrosService.porId(this.id()));
  protected readonly carregados = this.encontrosService.carregados;

  protected readonly quando = computed(() => {
    const encontro = this.encontro();
    return encontro ? formatarDataHora(encontro.data) : '';
  });

  protected readonly comoChegar = computed(() => {
    const encontro = this.encontro();
    return encontro ? linkComoChegar(encontro.posicao) : '';
  });

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const encontro = this.encontro();
    return encontro
      ? [{ id: encontro.id, posicao: encontro.posicao, titulo: encontro.titulo, tipo: 'destaque' }]
      : [];
  });

  constructor() {
    this.encontrosService.carregar();
  }

  protected alternarPresenca(): void {
    const encontro = this.encontro();
    if (encontro) this.encontrosService.alternarPresenca(encontro.id);
  }
}
