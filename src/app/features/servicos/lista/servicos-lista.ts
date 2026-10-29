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
import { mensagemDeErro, urlFoto } from '../../../core/api';
import { formatarDistancia, formatarPreco } from '../../../core/formato';
import { CENTRO_PADRAO, localizar } from '../../../core/geo';
import {
  LatLng,
  PrestadorProximo,
  rotuloServico,
  TIPOS_SERVICO,
  TipoServico,
} from '../../../core/models';
import {
  RAIO_PADRAO_SERVICO_KM,
  RAIOS_SERVICO_KM,
  ServicosService,
} from '../../../core/servicos.service';
import { Avatar } from '../../../shared/avatar/avatar';
import { Estrelas } from '../../../shared/estrelas/estrelas';

/** Passeadores, hospedagens e petshops perto do tutor. */
@Component({
  selector: 'app-servicos-lista',
  imports: [RouterLink, Avatar, Estrelas],
  templateUrl: './servicos-lista.html',
  styleUrl: './servicos-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicosLista {
  private readonly service = inject(ServicosService);

  protected readonly tipos = TIPOS_SERVICO;
  protected readonly raios = RAIOS_SERVICO_KM;
  protected readonly tipo = signal<TipoServico | null>(null);
  protected readonly raioKm = signal<number>(RAIO_PADRAO_SERVICO_KM);
  /** `null` enquanto espera o GPS, para não buscar num lugar que não é o do tutor. */
  protected readonly centro = signal<LatLng | null>(null);
  protected readonly semLocalizacao = signal(false);

  private readonly lista = signal<PrestadorProximo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  /** Descarta respostas de buscas antigas quando o tutor troca o filtro rápido. */
  private busca = 0;

  protected readonly prestadores = computed(() =>
    this.lista().map((p) => {
      const menor = p.precos.length ? Math.min(...p.precos.map((x) => x.valorCentavos)) : null;
      return {
        ...p,
        capa: urlFoto(p.fotos[0]),
        tipoLabel: rotuloServico(p.tipo),
        distancia: formatarDistancia(p.distanciaKm),
        aPartirDe: menor === null ? null : formatarPreco(menor),
      };
    }),
  );

  constructor() {
    effect(() => {
      const centro = this.centro();
      const raioKm = this.raioKm();
      const tipo = this.tipo();
      if (centro) untracked(() => this.carregar(centro, raioKm, tipo));
    });
    this.localizar();
  }

  protected filtrar(tipo: TipoServico | null): void {
    this.tipo.set(tipo);
  }

  protected escolherRaio(raioKm: number): void {
    this.raioKm.set(raioKm);
  }

  private async localizar(): Promise<void> {
    try {
      this.centro.set(await localizar());
    } catch {
      this.semLocalizacao.set(true);
      this.centro.set(CENTRO_PADRAO);
    }
  }

  private async carregar(centro: LatLng, raioKm: number, tipo: TipoServico | null): Promise<void> {
    const busca = ++this.busca;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.proximos(centro, raioKm, tipo);
      if (busca === this.busca) this.lista.set(lista);
    } catch (erro) {
      if (busca === this.busca) {
        this.erro.set(
          mensagemDeErro(erro, 'Não foi possível buscar os serviços agora. Tente novamente.'),
        );
      }
    } finally {
      if (busca === this.busca) this.carregando.set(false);
    }
  }
}
