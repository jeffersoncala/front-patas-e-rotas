import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { CENTRO_PADRAO } from '../../core/geo';
import { LatLng } from '../../core/models';

export interface MarcadorMapa {
  id: number | string;
  posicao: LatLng;
  titulo: string;
  /** `destaque` pinta o marcador de verde-água; `eu` mostra a posição do tutor. */
  tipo?: 'padrao' | 'destaque' | 'eu';
}

export interface TrajetoMapa {
  id: number | string;
  pontos: LatLng[];
  destaque?: boolean;
}

interface Contexto {
  L: typeof Leaflet;
  mapa: Leaflet.Map;
  camadas: Leaflet.LayerGroup;
}

const PATA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <ellipse cx="7" cy="8.5" rx="2.4" ry="3.1"/><ellipse cx="12" cy="6.4" rx="2.4" ry="3.2"/>
  <ellipse cx="17" cy="8.5" rx="2.4" ry="3.1"/>
  <path d="M12 11c3.3 0 6 2.3 6 5.1 0 2.2-1.8 3.9-4 3.9-1 0-1.5-.3-2-.3s-1 .3-2 .3c-2.2 0-4-1.7-4-3.9C6 13.3 8.7 11 12 11Z"/>
</svg>`;

/**
 * Mapa gratuito com Leaflet e tiles do OpenStreetMap (sem chave de API).
 * O Leaflet é carregado sob demanda, então só pesa nas telas que mostram mapa.
 */
@Component({
  selector: 'app-mapa',
  template: `<div #alvo class="mapa__alvo" role="region" [attr.aria-label]="rotulo()"></div>`,
  styleUrl: './mapa.scss',
  // Os elementos criados pelo Leaflet ficam fora da view do Angular.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mapa' },
})
export class Mapa {
  readonly rotulo = input('Mapa');
  readonly centro = input<LatLng>(CENTRO_PADRAO);
  readonly zoom = input(14);
  readonly marcadores = input<MarcadorMapa[]>([]);
  readonly trajetos = input<TrajetoMapa[]>([]);
  /** Enquadra automaticamente marcadores e trajetos sempre que mudarem. */
  readonly enquadrar = input(true);

  readonly cliqueMapa = output<LatLng>();
  readonly marcadorClicado = output<MarcadorMapa['id']>();

  private readonly alvo = viewChild.required<ElementRef<HTMLElement>>('alvo');
  private readonly contexto = signal<Contexto | null>(null);
  /** Pontos que o mapa deve enquadrar e a "assinatura" deles no último ajuste. */
  private limites: LatLng[] = [];
  private limitesAjustados = '';

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destruido = false;
    let observador: ResizeObserver | undefined;
    destroyRef.onDestroy(() => {
      destruido = true;
      observador?.disconnect();
      this.contexto()?.mapa.remove();
    });

    afterNextRender(async () => {
      // O Leaflet 1.x é UMD: dependendo do bundler o namespace vem em `default`.
      const modulo = await import('leaflet');
      const L = ((modulo as { default?: typeof Leaflet }).default ?? modulo) as typeof Leaflet;
      if (destruido) return;

      const mapa = L.map(this.alvo().nativeElement, { zoomControl: true }).setView(
        this.centro(),
        this.zoom(),
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      mapa.on('click', (e) => this.cliqueMapa.emit([e.latlng.lat, e.latlng.lng]));

      const contexto: Contexto = { L, mapa, camadas: L.layerGroup().addTo(mapa) };
      this.contexto.set(contexto);

      // O Leaflet só mede o container ao ser criado. Como o layout ainda se ajusta depois
      // (grid, sticky, fontes), sem isso parte dos tiles fica cinza e o enquadramento erra.
      if (typeof ResizeObserver !== 'undefined') {
        observador = new ResizeObserver(() => {
          mapa.invalidateSize({ animate: false });
          this.ajustarVisao(contexto);
        });
        observador.observe(this.alvo().nativeElement);
      }
    });

    effect(() => {
      const ctx = this.contexto();
      if (ctx) this.desenhar(ctx, this.marcadores(), this.trajetos());
    });

    // Recentraliza quando o centro muda e não há nada para enquadrar.
    effect(() => {
      const ctx = this.contexto();
      const centro = this.centro();
      if (ctx && untracked(() => !this.enquadrar() || this.vazio())) {
        ctx.mapa.setView(centro, ctx.mapa.getZoom(), { animate: false });
      }
    });
  }

  private vazio(): boolean {
    return this.marcadores().length === 0 && this.trajetos().length === 0;
  }

  private desenhar(
    { L, mapa, camadas }: Contexto,
    marcadores: MarcadorMapa[],
    trajetos: TrajetoMapa[],
  ): void {
    camadas.clearLayers();
    const limites: LatLng[] = [];

    // Trajetos em destaque por último, para ficarem por cima dos outros.
    for (const trajeto of [...trajetos].sort((a, b) => Number(a.destaque) - Number(b.destaque))) {
      if (trajeto.pontos.length === 0) continue;
      const espessura = trajeto.destaque ? 5 : 4;
      // Contorno branco por baixo: sem ele a linha some entre as ruas coloridas dos tiles.
      L.polyline(trajeto.pontos, {
        className: 'mapa-trajeto__contorno',
        weight: espessura + 4,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(camadas);
      L.polyline(trajeto.pontos, {
        className: trajeto.destaque ? 'mapa-trajeto mapa-trajeto--destaque' : 'mapa-trajeto',
        weight: espessura,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(camadas);
      limites.push(...trajeto.pontos);
    }

    for (const marcador of marcadores) {
      const tipo = marcador.tipo ?? 'padrao';
      L.marker(marcador.posicao, {
        title: marcador.titulo,
        alt: marcador.titulo,
        keyboard: true,
        icon: L.divIcon({
          className: `mapa-pino mapa-pino--${tipo}`,
          // O giro fica num filho: `rotate` no próprio ícone também giraria o translate3d
          // que o Leaflet usa para posicioná-lo, e o pino apareceria fora do lugar.
          html: tipo === 'eu' ? '' : `<span class="mapa-pino__gota">${PATA_SVG}</span>`,
          iconSize: tipo === 'eu' ? [18, 18] : [36, 36],
          iconAnchor: tipo === 'eu' ? [9, 9] : [18, 36],
        }),
      })
        .on('click', () => this.marcadorClicado.emit(marcador.id))
        .addTo(camadas);
      limites.push(marcador.posicao);
    }

    this.limites = limites;
    // Só reenquadra quando as posições mudam: trocar o destaque não desfaz o zoom do tutor.
    const assinatura = `${this.enquadrar()}|${limites.join(';')}`;
    if (assinatura !== this.limitesAjustados) {
      this.limitesAjustados = assinatura;
      this.ajustarVisao({ L, mapa, camadas });
    }
  }

  /**
   * Sem animação de propósito: redesenhar camadas durante a animação de zoom faz o
   * Leaflet posicionar os marcadores fora do lugar.
   */
  private ajustarVisao({ L, mapa }: Contexto): void {
    const limites = this.limites;
    if (!untracked(this.enquadrar) || limites.length === 0) return;
    if (limites.length === 1) {
      mapa.setView(limites[0], Math.max(mapa.getZoom(), 15), { animate: false });
    } else {
      mapa.fitBounds(L.latLngBounds(limites), { padding: [32, 32], maxZoom: 16, animate: false });
    }
  }
}
