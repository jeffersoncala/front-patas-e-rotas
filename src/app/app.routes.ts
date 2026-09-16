import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Patas & Rotas',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  // TODO: '/cadastro' e '/recuperar-senha' ainda não existem; até lá caem no login.
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
