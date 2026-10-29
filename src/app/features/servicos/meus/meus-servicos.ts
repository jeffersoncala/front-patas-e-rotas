import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensagemDeErro, urlFoto } from '../../../core/api';
import { Prestador, rotuloServico, TIPOS_SERVICO } from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Estrelas } from '../../../shared/estrelas/estrelas';

/** Os serviços que o tutor oferece (um de cada tipo), com atalhos para editar e pausar. */
@Component({
  selector: 'app-meus-servicos',
  imports: [RouterLink, Estrelas],
  templateUrl: './meus-servicos.html',
  styleUrl: './meus-servicos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeusServicos {
  private readonly service = inject(ServicosService);

  private readonly lista = signal<Prestador[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly alterando = signal<number | null>(null);

  protected readonly meus = computed(() =>
    this.lista().map((p) => ({
      ...p,
      tipoLabel: rotuloServico(p.tipo),
      capa: urlFoto(p.fotos[0]),
    })),
  );

  /** Tipos que o tutor ainda não oferece. */
  protected readonly disponiveis = computed(() => {
    const usados = new Set(this.lista().map((p) => p.tipo));
    return TIPOS_SERVICO.filter((t) => !usados.has(t.id));
  });

  constructor() {
    this.carregar();
  }

  protected async alternarAtivo(prestador: Prestador): Promise<void> {
    this.erro.set(null);
    this.alterando.set(prestador.id);
    try {
      const salvo = await this.service.alterar(prestador.id, { ativo: !prestador.ativo });
      this.lista.update((lista) => lista.map((p) => (p.id === salvo.id ? salvo : p)));
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível atualizar agora. Tente novamente.'));
    } finally {
      this.alterando.set(null);
    }
  }

  private async carregar(): Promise<void> {
    try {
      this.lista.set(await this.service.meus());
    } catch (erro) {
      this.erro.set(
        mensagemDeErro(erro, 'Não foi possível carregar seus serviços. Tente novamente.'),
      );
    } finally {
      this.carregando.set(false);
    }
  }
}
