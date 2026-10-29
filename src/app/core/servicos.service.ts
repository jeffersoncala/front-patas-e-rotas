import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import {
  Acompanhamento,
  Avaliacao,
  Contratacao,
  LatLng,
  Prestador,
  PrestadorProximo,
  StatusContratacao,
  TipoServico,
} from './models';

export type DadosPrestador = Pick<
  Prestador,
  'tipo' | 'nome' | 'descricao' | 'contato' | 'bairro' | 'posicao' | 'precos'
> & {
  /** Na criação, data URLs já reduzidos; na edição, a lista final (caminhos que ficam e novas). */
  fotos: string[];
};

export type AlteracaoPrestador = Partial<Omit<DadosPrestador, 'tipo'> & { ativo: boolean }>;

export interface NovaContratacao {
  prestadorId: number;
  petIds: number[];
  /** ISO 8601. */
  inicio: string;
  /** Só na hospedagem. */
  fim?: string;
  contato: string;
  mensagem: string;
}

/** Raios oferecidos na busca, em km. A API aceita até 100. */
export const RAIOS_SERVICO_KM = [3, 5, 10, 25, 50] as const;
export const RAIO_PADRAO_SERVICO_KM = 10;

/** O mesmo limite da API. */
export const MAX_FOTOS_PRESTADOR = 6;

/**
 * Prestadores de serviço (passeador, hospedagem, banho e tosa), os pedidos feitos a eles e as
 * avaliações. Sem cache: o status dos pedidos muda pelo outro lado a qualquer momento.
 */
@Injectable({ providedIn: 'root' })
export class ServicosService {
  private readonly http = inject(HttpClient);
  private readonly prestadores = `${API_URL}/prestadores`;
  private readonly contratacoes = `${API_URL}/contratacoes`;

  /** Ativos dentro do raio, do mais perto para o mais longe; sem tipo, traz todos. */
  proximos(
    [lat, lng]: LatLng,
    raioKm: number,
    tipo: TipoServico | null,
  ): Promise<PrestadorProximo[]> {
    let params = new HttpParams().set('lat', lat).set('lng', lng).set('raioKm', raioKm);
    if (tipo) params = params.set('tipo', tipo);
    return firstValueFrom(this.http.get<PrestadorProximo[]>(this.prestadores, { params }));
  }

  /** Os serviços que quem está logado oferece, inclusive os pausados. */
  meus(): Promise<Prestador[]> {
    return firstValueFrom(this.http.get<Prestador[]>(`${this.prestadores}/meus`));
  }

  buscar(id: number): Promise<Prestador> {
    return firstValueFrom(this.http.get<Prestador>(`${this.prestadores}/${id}`));
  }

  avaliacoes(id: number): Promise<Avaliacao[]> {
    return firstValueFrom(this.http.get<Avaliacao[]>(`${this.prestadores}/${id}/avaliacoes`));
  }

  criar(dados: DadosPrestador): Promise<Prestador> {
    return firstValueFrom(this.http.post<Prestador>(this.prestadores, dados));
  }

  alterar(id: number, dados: AlteracaoPrestador): Promise<Prestador> {
    return firstValueFrom(this.http.patch<Prestador>(`${this.prestadores}/${id}`, dados));
  }

  apagar(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.prestadores}/${id}`));
  }

  /** Pedidos que fiz (`cliente`) ou que recebi (`prestador`), os mais novos primeiro. */
  pedidos(papel: Contratacao['papel']): Promise<Contratacao[]> {
    const params = new HttpParams().set('papel', papel);
    return firstValueFrom(this.http.get<Contratacao[]>(this.contratacoes, { params }));
  }

  contratar(dados: NovaContratacao): Promise<Contratacao> {
    return firstValueFrom(this.http.post<Contratacao>(this.contratacoes, dados));
  }

  mudarStatus(id: number, status: Exclude<StatusContratacao, 'pendente'>): Promise<Contratacao> {
    return firstValueFrom(
      this.http.put<Contratacao>(`${this.contratacoes}/${id}/status`, { status }),
    );
  }

  avaliar(id: number, nota: number, comentario: string): Promise<Contratacao> {
    return firstValueFrom(
      this.http.put<Contratacao>(`${this.contratacoes}/${id}/avaliacao`, { nota, comentario }),
    );
  }

  /** Um pedido só (o cliente e o prestador enxergam). */
  pedido(id: number): Promise<Contratacao> {
    return firstValueFrom(this.http.get<Contratacao>(`${this.contratacoes}/${id}`));
  }

  /** O passeador envia os pontos do GPS juntados desde o último envio. */
  enviarPosicoes(id: number, pontos: LatLng[]): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.contratacoes}/${id}/posicoes`, { pontos }));
  }

  /** Estado do passeio e os pontos a partir de `desde` (os que quem pergunta ainda não tem). */
  acompanhamento(id: number, desde = 0): Promise<Acompanhamento> {
    const params = new HttpParams().set('desde', desde);
    return firstValueFrom(
      this.http.get<Acompanhamento>(`${this.contratacoes}/${id}/acompanhamento`, { params }),
    );
  }
}
