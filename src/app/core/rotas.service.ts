import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';
import { Rota } from './models';

export type NovaRota = Pick<Rota, 'nome' | 'bairro' | 'descricao' | 'pontos' | 'duracaoMin'>;

@Injectable({ providedIn: 'root' })
export class RotasService {
  private readonly http = inject(HttpClient);
  private readonly _rotas = signal<Rota[]>([]);
  private readonly _carregadas = signal(false);

  readonly rotas = this._rotas.asReadonly();
  readonly favoritas = computed(() => this.rotas().filter((r) => r.favorita));
  /** Se a lista já veio da API pelo menos uma vez (antes disso "não encontrada" é cedo). */
  readonly carregadas = this._carregadas.asReadonly();

  constructor() {
    inject(AuthService).aoSair(() => {
      this._rotas.set([]);
      this._carregadas.set(false);
    });
  }

  /** Busca a lista na API. As telas chamam ao abrir, para mostrar o que há de novo. */
  carregar(): void {
    this.http.get<Rota[]>(`${API_URL}/rotas`).subscribe((rotas) => {
      this._rotas.set(rotas);
      this._carregadas.set(true);
    });
  }

  porId(id: number): Rota | undefined {
    return this._rotas().find((r) => r.id === id);
  }

  alternarFavorita(id: number): void {
    const rota = this.porId(id);
    if (!rota) return;
    const url = `${API_URL}/rotas/${id}/favorita`;
    (rota.favorita ? this.http.delete<Rota>(url) : this.http.put<Rota>(url, null)).subscribe(
      (atualizada) => this.substituir(atualizada),
    );
  }

  async criar(dados: NovaRota): Promise<Rota> {
    const rota = await firstValueFrom(this.http.post<Rota>(`${API_URL}/rotas`, dados));
    this._rotas.update((lista) => [...lista, rota]);
    return rota;
  }

  private substituir(rota: Rota): void {
    this._rotas.update((lista) => lista.map((r) => (r.id === rota.id ? rota : r)));
  }
}
