import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { Desaparecido, DesaparecidoProximo, LatLng } from './models';

export type NovoDesaparecido = Pick<
  Desaparecido,
  'nome' | 'especie' | 'raca' | 'porte' | 'descricao' | 'contato' | 'posicao' | 'vistoEm'
> & {
  /** Data URL já reduzido; sem foto, fica de fora. */
  foto?: string;
};

/** Raios oferecidos na busca, em km. A API aceita até 100. */
export const RAIOS_KM = [1, 3, 5, 10, 25, 50] as const;
export const RAIO_PADRAO_KM = 5;

/**
 * Sem cache: a lista depende do centro e do raio escolhidos na tela, e quem está procurando
 * um pet quer ver sempre o que há de mais novo.
 */
@Injectable({ providedIn: 'root' })
export class DesaparecidosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/desaparecidos`;

  /** Ainda não encontrados dentro do raio, do mais perto para o mais longe. */
  proximos([lat, lng]: LatLng, raioKm: number): Promise<DesaparecidoProximo[]> {
    const params = new HttpParams().set('lat', lat).set('lng', lng).set('raioKm', raioKm);
    return firstValueFrom(this.http.get<DesaparecidoProximo[]>(this.url, { params }));
  }

  criar(dados: NovoDesaparecido): Promise<Desaparecido> {
    return firstValueFrom(this.http.post<Desaparecido>(this.url, dados));
  }

  marcarEncontrado(id: number): Promise<Desaparecido> {
    return firstValueFrom(this.http.put<Desaparecido>(`${this.url}/${id}/encontrado`, null));
  }
}
