import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { EncontrosService } from '../../core/encontros.service';
import { formatarHora, formatarKm, partesData, tempoRelativo } from '../../core/formato';
import { nomesPets } from '../../core/models';
import { PasseiosService } from '../../core/passeios.service';
import { RotasService } from '../../core/rotas.service';
import { Avatar } from '../../shared/avatar/avatar';
import { Mapa, MarcadorMapa } from '../../shared/mapa/mapa';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Avatar, Mapa],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly encontrosService = inject(EncontrosService);
  private readonly passeiosService = inject(PasseiosService);
  private readonly rotasService = inject(RotasService);

  protected readonly perfil = inject(AuthService).perfil;
  protected readonly nomesDosPets = computed(() => nomesPets(this.perfil()?.pets ?? []));
  protected readonly passeios = this.passeiosService.passeios;
  protected readonly kmSemana = this.passeiosService.kmSemana;
  protected readonly passeiosSemana = this.passeiosService.passeiosSemana;
  private readonly favoritas = this.rotasService.favoritas;
  protected readonly rotasFavoritas = computed(() => this.favoritas().slice(0, 3));

  protected readonly encontros = computed(() => this.encontrosService.encontros().slice(0, 3));
  protected readonly encontrosConfirmados = computed(
    () => this.encontrosService.confirmados().length,
  );
  protected readonly marcadores = computed<MarcadorMapa[]>(() =>
    this.encontros().map((e) => ({
      id: e.id,
      posicao: e.posicao,
      titulo: e.titulo,
      tipo: e.vou ? 'destaque' : 'padrao',
    })),
  );

  protected readonly metaSemanalKm = computed(() => this.perfil()?.metaSemanalKm ?? 15);
  protected readonly faltaMetaKm = computed(() =>
    Math.max(0, this.metaSemanalKm() - this.kmSemana()),
  );
  /** Percentual da meta semanal, limitado a 100 para a barra de progresso. */
  protected readonly progressoMeta = computed(() =>
    Math.min(100, Math.round((this.kmSemana() / this.metaSemanalKm()) * 100)),
  );

  protected readonly saudacao = computed(() => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  });

  protected readonly formatarKm = formatarKm;
  protected readonly formatarHora = formatarHora;
  protected readonly partesData = partesData;
  protected readonly tempoRelativo = tempoRelativo;
  protected readonly nomesPets = nomesPets;

  constructor() {
    this.encontrosService.carregar();
    this.passeiosService.carregar();
    this.rotasService.carregar();
  }

  protected alternarPresenca(id: number): void {
    this.encontrosService.alternarPresenca(id);
  }

  protected alternarCurtida(id: number): void {
    this.passeiosService.alternarCurtida(id);
  }
}
