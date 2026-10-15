import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Avatar } from '../avatar/avatar';
import { Pata } from '../pata/pata';

/** Layout das telas internas: barra superior com a navegação e o conteúdo da rota. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, Pata],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  protected readonly perfil = this.auth.perfil;

  protected readonly links = [
    { rota: '/', label: 'Início', exato: true },
    { rota: '/encontros', label: 'Encontros', exato: false },
    { rota: '/passeios/novo', label: 'Passear', exato: false },
    { rota: '/rotas', label: 'Rotas', exato: false },
    { rota: '/perfil', label: 'Perfil', exato: false },
  ] as const;

  constructor() {
    // O perfil guardado na sessão pode estar velho (ex.: editado em outro aparelho).
    this.auth.carregarPerfil().catch(() => undefined);
  }
}
