import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Avatar } from '../avatar/avatar';
import { Pata } from '../pata/pata';

interface LinkNav {
  rota: string;
  label: string;
  /** Rótulo da barra do rodapé no celular, onde falta espaço. */
  curto?: string;
  exato: boolean;
}

/** Layout das telas internas: barra superior com a navegação e o conteúdo da rota. */
@Component({
  selector: 'app-shell',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, Avatar, Pata],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  protected readonly perfil = this.auth.perfil;

  protected readonly links: readonly LinkNav[] = [
    { rota: '/', label: 'Início', exato: true },
    { rota: '/encontros', label: 'Encontros', exato: false },
    { rota: '/passeios/novo', label: 'Passear', exato: false },
    { rota: '/rotas', label: 'Rotas', exato: false },
    { rota: '/desaparecidos', label: 'Desaparecidos', curto: 'Perdidos', exato: false },
    { rota: '/perfil', label: 'Perfil', exato: false },
  ];

  constructor() {
    // O perfil guardado na sessão pode estar velho (ex.: editado em outro aparelho).
    this.auth.carregarPerfil().catch(() => undefined);
  }
}
