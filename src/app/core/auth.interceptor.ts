import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';

const comToken = (req: HttpRequest<unknown>, token: string | null) =>
  token && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

/**
 * Manda o access token nas chamadas à API. Se ele expirou (401), renova a sessão
 * uma vez e repete a requisição; sem conseguir renovar, leva o tutor para o login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken();

  return next(comToken(req, token)).pipe(
    catchError((erro: unknown) => {
      const renovavel =
        erro instanceof HttpErrorResponse &&
        erro.status === 401 &&
        token !== null &&
        !req.url.startsWith(`${API_URL}/auth/`);
      if (!renovavel) return throwError(() => erro);

      return from(auth.renovarSessao()).pipe(
        switchMap((novo) => {
          if (!novo) {
            void router.navigateByUrl('/login');
            return throwError(() => erro);
          }
          return next(comToken(req, novo));
        }),
      );
    }),
  );
};
