import { Routes } from '@angular/router';
import { authGuard, visitanteGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Patas & Rotas',
    canActivate: [visitanteGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'cadastro',
    title: 'Criar conta · Patas & Rotas',
    canActivate: [visitanteGuard],
    loadComponent: () => import('./features/auth/cadastro/cadastro').then((m) => m.Cadastro),
  },
  {
    path: 'recuperar-senha',
    title: 'Recuperar senha · Patas & Rotas',
    loadComponent: () =>
      import('./features/auth/recuperar-senha/recuperar-senha').then((m) => m.RecuperarSenha),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Início · Patas & Rotas',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'encontros',
        title: 'Encontros · Patas & Rotas',
        loadComponent: () =>
          import('./features/encontros/lista/encontros-lista').then((m) => m.EncontrosLista),
      },
      {
        path: 'encontros/novo',
        title: 'Novo encontro · Patas & Rotas',
        loadComponent: () =>
          import('./features/encontros/novo/novo-encontro').then((m) => m.NovoEncontro),
      },
      {
        path: 'encontros/:id',
        title: 'Encontro · Patas & Rotas',
        loadComponent: () =>
          import('./features/encontros/detalhe/encontro-detalhe').then((m) => m.EncontroDetalhe),
      },
      {
        path: 'rotas',
        title: 'Rotas · Patas & Rotas',
        loadComponent: () => import('./features/rotas/lista/rotas-lista').then((m) => m.RotasLista),
      },
      {
        path: 'rotas/:id',
        title: 'Rota · Patas & Rotas',
        loadComponent: () =>
          import('./features/rotas/detalhe/rota-detalhe').then((m) => m.RotaDetalhe),
      },
      {
        path: 'passeios/novo',
        title: 'Registrar passeio · Patas & Rotas',
        loadComponent: () =>
          import('./features/passeios/novo/novo-passeio').then((m) => m.NovoPasseio),
      },
      {
        path: 'perfil',
        title: 'Perfil · Patas & Rotas',
        loadComponent: () => import('./features/perfil/meu-perfil').then((m) => m.MeuPerfil),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
