import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import {
  DesaparecidosService,
  RAIO_PADRAO_KM,
  RAIOS_KM,
} from '../../../core/desaparecidos.service';
import { formatarDistancia, linksTelefone, tempoRelativo } from '../../../core/formato';
import { CENTRO_PADRAO, FalhaLocalizacao, localizar } from '../../../core/geo';
import { DesaparecidoProximo, ESPECIES, LatLng, PORTES } from '../../../core/models';
import { Avatar } from '../../../shared/avatar/avatar';
import { CirculoMapa, Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';

/** De onde veio o centro da busca. */
type Origem = 'gps' | 'mapa' | 'padrao';

const AVISOS_LOCALIZACAO: Record<FalhaLocalizacao, string> = {
  indisponivel: 'Seu navegador não informa a localização.',
  negada: 'Sem permissão para usar sua localização.',
  falhou: 'Não conseguimos achar sua localização agora.',
};

const rotulo = <T extends string>(opcoes: readonly { id: T; label: string }[], id: T) =>
  opcoes.find((o) => o.id === id)?.label ?? id;

@Component({
  selector: 'app-desaparecidos-lista',
  imports: [RouterLink, Mapa, Avatar],
  templateUrl: './desaparecidos-lista.html',
  styleUrl: './desaparecidos-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesaparecidosLista {
  private readonly service = inject(DesaparecidosService);

  protected readonly raios = RAIOS_KM;
  protected readonly centroPadrao = CENTRO_PADRAO;
  protected readonly raioKm = signal<number>(RAIO_PADRAO_KM);
  /** `null` enquanto espera o GPS, para não buscar num lugar que não é o do tutor. */
  protected readonly centro = signal<LatLng | null>(null);
  protected readonly origem = signal<Origem>('padrao');
  protected readonly localizando = signal(false);
  protected readonly avisoLocalizacao = signal<string | null>(null);

  private readonly lista = signal<DesaparecidoProximo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly selecionado = signal<number | null>(null);
  /** Descarta respostas de buscas antigas quando o tutor troca o raio rápido. */
  private busca = 0;

  protected readonly desaparecidos = computed(() =>
    this.lista().map((d) => ({
      ...d,
      distancia: formatarDistancia(d.distanciaKm),
      visto: tempoRelativo(d.vistoEm),
      detalhes: [
        rotulo(ESPECIES, d.especie),
        d.raca,
        `porte ${rotulo(PORTES, d.porte).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(' · '),
      telefone: linksTelefone(d.contato),
    })),
  );

  protected readonly marcadores = computed<MarcadorMapa[]>(() => {
    const centro = this.centro();
    const marcadores: MarcadorMapa[] = this.lista().map((d) => ({
      id: d.id,
      posicao: d.posicao,
      titulo: `${d.nome}, visto aqui`,
      tipo: d.id === this.selecionado() ? 'destaque' : 'padrao',
    }));
    if (centro) {
      const titulo = this.origem() === 'gps' ? 'Você está aqui' : 'Centro da busca';
      marcadores.unshift({ id: 'centro', posicao: centro, titulo, tipo: 'eu' });
    }
    return marcadores;
  });

  protected readonly circulo = computed<CirculoMapa | null>(() => {
    const centro = this.centro();
    return centro && { centro, raioKm: this.raioKm() };
  });

  constructor() {
    effect(() => {
      const centro = this.centro();
      const raioKm = this.raioKm();
      if (centro) untracked(() => this.carregar(centro, raioKm));
    });
    this.usarMinhaLocalizacao();
  }

  protected escolherRaio(raioKm: number): void {
    this.raioKm.set(raioKm);
  }

  /** Clique no mapa: busca em volta de outro ponto (ex.: onde o pet sumiu). */
  protected buscarAqui(posicao: LatLng): void {
    this.origem.set('mapa');
    this.centro.set(posicao);
  }

  protected async usarMinhaLocalizacao(): Promise<void> {
    this.avisoLocalizacao.set(null);
    this.localizando.set(true);
    try {
      this.centro.set(await localizar());
      this.origem.set('gps');
    } catch (falha) {
      this.avisoLocalizacao.set(
        `${AVISOS_LOCALIZACAO[falha as FalhaLocalizacao] ?? AVISOS_LOCALIZACAO.falhou} Toque no mapa para escolher onde buscar.`,
      );
      // Sem GPS, só cai no centro padrão se ainda não havia um ponto escolhido.
      if (!this.centro()) {
        this.origem.set('padrao');
        this.centro.set(CENTRO_PADRAO);
      }
    } finally {
      this.localizando.set(false);
    }
  }

  protected selecionar(id: number): void {
    this.selecionado.set(id);
  }

  /** Clique no pino do mapa: destaca e leva o item correspondente para a vista. */
  protected aoClicarMarcador(id: MarcadorMapa['id']): void {
    if (id === 'centro') return;
    const desaparecidoId = Number(id);
    this.selecionado.set(desaparecidoId);
    document
      .getElementById(`desaparecido-${desaparecidoId}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  protected async marcarEncontrado(desaparecido: DesaparecidoProximo): Promise<void> {
    if (!confirm(`Que bom! Confirma que ${desaparecido.nome} foi encontrado?`)) return;
    this.erro.set(null);
    try {
      await this.service.marcarEncontrado(desaparecido.id);
      this.lista.update((lista) => lista.filter((d) => d.id !== desaparecido.id));
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível atualizar agora. Tente novamente.'));
    }
  }

  private async carregar(centro: LatLng, raioKm: number): Promise<void> {
    const busca = ++this.busca;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.proximos(centro, raioKm);
      if (busca === this.busca) this.lista.set(lista);
    } catch (erro) {
      if (busca === this.busca) {
        this.erro.set(
          mensagemDeErro(erro, 'Não foi possível buscar os pets agora. Tente novamente.'),
        );
      }
    } finally {
      if (busca === this.busca) this.carregando.set(false);
    }
  }
}
