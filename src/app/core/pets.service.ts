import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { PaginaAlbum, PerfilPet } from './models';

/** Fotos por página do álbum. A API aceita até 60. */
export const LIMITE_ALBUM = 24;

/** Perfil público dos pets de qualquer tutor. Sem cache: cada tela busca o que precisa. */
@Injectable({ providedIn: 'root' })
export class PetsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/pets`;

  perfil(id: number): Promise<PerfilPet> {
    return firstValueFrom(this.http.get<PerfilPet>(`${this.url}/${id}`));
  }

  /** Uma página do álbum; passe o `proximoCursor` da anterior para continuar. */
  album(id: number, antesDe?: string): Promise<PaginaAlbum> {
    let params = new HttpParams().set('limite', LIMITE_ALBUM);
    if (antesDe) params = params.set('antesDe', antesDe);
    return firstValueFrom(this.http.get<PaginaAlbum>(`${this.url}/${id}/album`, { params }));
  }
}
