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
        path: 'desaparecidos',
        title: 'Desaparecidos · Patas & Rotas',
        loadComponent: () =>
          import('./features/desaparecidos/lista/desaparecidos-lista').then(
            (m) => m.DesaparecidosLista,
          ),
      },
      {
        path: 'desaparecidos/novo',
        title: 'Cadastrar desaparecido · Patas & Rotas',
        loadComponent: () =>
          import('./features/desaparecidos/novo/novo-desaparecido').then((m) => m.NovoDesaparecido),
      },
      {
        path: 'servicos',
        title: 'Serviços · Patas & Rotas',
        loadComponent: () =>
          import('./features/servicos/lista/servicos-lista').then((m) => m.ServicosLista),
      },
      {
        path: 'servicos/pedidos',
        title: 'Meus pedidos · Patas & Rotas',
        loadComponent: () => import('./features/servicos/pedidos/pedidos').then((m) => m.Pedidos),
      },
      {
        path: 'servicos/meus',
        title: 'Meus serviços · Patas & Rotas',
        loadComponent: () =>
          import('./features/servicos/meus/meus-servicos').then((m) => m.MeusServicos),
      },
      {
        path: 'servicos/novo',
        title: 'Oferecer serviço · Patas & Rotas',
        loadComponent: () =>
          import('./features/servicos/editar/editar-prestador').then((m) => m.EditarPrestador),
      },
      {
        path: 'servicos/:id',
        title: 'Serviço · Patas & Rotas',
        loadComponent: () =>
          import('./features/servicos/detalhe/prestador-detalhe').then((m) => m.PrestadorDetalhe),
      },
      {
        path: 'servicos/:id/editar',
        title: 'Editar serviço · Patas & Rotas',
        loadComponent: () =>
          import('./features/servicos/editar/editar-prestador').then((m) => m.EditarPrestador),
      },
      {
        path: 'passeios/novo',
        title: 'Registrar passeio · Patas & Rotas',
        loadComponent: () =>
          import('./features/passeios/novo/novo-passeio').then((m) => m.NovoPasseio),
      },
      {
        path: 'passeios/:id/editar',
        title: 'Editar passeio · Patas & Rotas',
        loadComponent: () =>
          import('./features/passeios/editar/editar-passeio').then((m) => m.EditarPasseio),
      },
      {
        path: 'pets/:id',
        title: 'Perfil do pet · Patas & Rotas',
        loadComponent: () => import('./features/pets/perfil-pet').then((m) => m.PerfilPet),
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
