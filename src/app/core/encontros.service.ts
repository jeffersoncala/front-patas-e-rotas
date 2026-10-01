import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';
import { Encontro } from './models';

export type NovoEncontro = Pick<Encontro, 'titulo' | 'descricao' | 'local' | 'posicao' | 'data'>;

@Injectable({ providedIn: 'root' })
export class EncontrosService {
  private readonly http = inject(HttpClient);
  private readonly _encontros = signal<Encontro[]>([]);
  private readonly _carregados = signal(false);

  /** Encontros futuros, do mais próximo para o mais distante no tempo. */
  readonly encontros = computed(() =>
    [...this._encontros()].sort((a, b) => a.data.localeCompare(b.data)),
  );
  readonly confirmados = computed(() => this.encontros().filter((e) => e.vou));
  /** Se a lista já veio da API pelo menos uma vez (antes disso "não encontrado" é cedo). */
  readonly carregados = this._carregados.asReadonly();

  constructor() {
    inject(AuthService).aoSair(() => {
      this._encontros.set([]);
      this._carregados.set(false);
    });
  }

  /** Busca a lista na API. As telas chamam ao abrir, para mostrar o que há de novo. */
  carregar(): void {
    this.http.get<Encontro[]>(`${API_URL}/encontros`).subscribe((encontros) => {
      this._encontros.set(encontros);
      this._carregados.set(true);
    });
  }

  porId(id: number): Encontro | undefined {
    return this._encontros().find((e) => e.id === id);
  }

  alternarPresenca(id: number): void {
    const encontro = this.porId(id);
    if (!encontro) return;
    const url = `${API_URL}/encontros/${id}/presenca`;
    (encontro.vou ? this.http.delete<Encontro>(url) : this.http.put<Encontro>(url, null)).subscribe(
      (atualizado) => this.substituir(atualizado),
    );
  }

  async criar(dados: NovoEncontro): Promise<Encontro> {
    const encontro = await firstValueFrom(this.http.post<Encontro>(`${API_URL}/encontros`, dados));
    this._encontros.update((lista) => [...lista, encontro]);
    return encontro;
  }

  private substituir(encontro: Encontro): void {
    this._encontros.update((lista) => lista.map((e) => (e.id === encontro.id ? encontro : e)));
  }
}
