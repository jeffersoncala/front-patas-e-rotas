import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';
import { Passeio, ResumoPerfil } from './models';

/** Quantos passeios a home e o perfil mostram. */
const LIMITE = 50;

interface PaginaPasseios {
  itens: Passeio[];
  proximoCursor: string | null;
}

export type NovoPasseio = Pick<
  Passeio,
  'pontos' | 'duracaoMin' | 'texto' | 'rotaId' | 'rotaNome'
> & {
  /** Pets do tutor que foram no passeio; vazio deixa a API usar todos. */
  petIds: number[];
};

@Injectable({ providedIn: 'root' })
export class PasseiosService {
  private readonly http = inject(HttpClient);
  private readonly _feed = signal<Passeio[]>([]);
  private readonly _meus = signal<Passeio[]>([]);
  private readonly resumo = signal<ResumoPerfil | null>(null);

  /** Feed em ordem do mais recente para o mais antigo. */
  readonly passeios = this._feed.asReadonly();
  readonly meus = this._meus.asReadonly();

  readonly kmSemana = computed(() => this.resumo()?.kmSemana ?? 0);
  readonly passeiosSemana = computed(() => this.resumo()?.passeiosSemana ?? 0);
  readonly kmTotal = computed(() => this.resumo()?.kmTotal ?? 0);
  readonly totalPasseios = computed(() => this.resumo()?.totalPasseios ?? 0);
  readonly encontrosConfirmados = computed(() => this.resumo()?.encontrosConfirmados ?? 0);

  constructor() {
    inject(AuthService).aoSair(() => {
      this._feed.set([]);
      this._meus.set([]);
      this.resumo.set(null);
    });
  }

  /** Busca feed, passeios do tutor e o resumo da semana. As telas chamam ao abrir. */
  carregar(): void {
    this.pagina('todos').subscribe((itens) => this._feed.set(itens));
    this.pagina('eu').subscribe((itens) => this._meus.set(itens));
    this.carregarResumo();
  }

  /** Passeios feitos numa rota, mais recentes primeiro. */
  daRota(rotaId: number): Observable<Passeio[]> {
    return this.http.get<Passeio[]>(`${API_URL}/rotas/${rotaId}/passeios`);
  }

  alternarCurtida(id: number): void {
    const passeio = [...this._feed(), ...this._meus()].find((p) => p.id === id);
    if (!passeio) return;
    const url = `${API_URL}/passeios/${id}/curtida`;
    (passeio.curtido ? this.http.delete<Passeio>(url) : this.http.put<Passeio>(url, null)).subscribe(
      (atualizado) => {
        const trocar = (lista: Passeio[]) => lista.map((p) => (p.id === id ? atualizado : p));
        this._feed.update(trocar);
        this._meus.update(trocar);
      },
    );
  }

  async registrar({ rotaId, rotaNome, petIds, ...dados }: NovoPasseio): Promise<Passeio> {
    // A API pega o nome da rota pelo id; `rotaNome` só vale para passeio livre.
    const corpo = {
      ...dados,
      ...(rotaId === null ? { rotaNome } : { rotaId }),
      ...(petIds.length > 0 && { petIds }),
    };
    const passeio = await firstValueFrom(this.http.post<Passeio>(`${API_URL}/passeios`, corpo));
    this._feed.update((lista) => [passeio, ...lista]);
    this._meus.update((lista) => [passeio, ...lista]);
    this.carregarResumo();
    return passeio;
  }

  private pagina(autor: 'todos' | 'eu'): Observable<Passeio[]> {
    return this.http
      .get<PaginaPasseios>(`${API_URL}/passeios`, { params: { autor, limite: LIMITE } })
      .pipe(map((pagina) => pagina.itens));
  }

  private carregarResumo(): void {
    this.http
      .get<ResumoPerfil>(`${API_URL}/perfil/resumo`)
      .subscribe((resumo) => this.resumo.set(resumo));
  }
}
