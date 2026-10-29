import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../../core/api';
import { formatarDataHora, linksTelefone } from '../../../core/formato';
import {
  Contratacao,
  nomesPets,
  rotuloServico,
  STATUS_CONTRATACAO,
  StatusContratacao,
} from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Avatar } from '../../../shared/avatar/avatar';
import { Estrelas } from '../../../shared/estrelas/estrelas';

type Papel = Contratacao['papel'];
type Acao = { status: Exclude<StatusContratacao, 'pendente'>; label: string; perigo?: boolean };

const CONFIRMACOES: Partial<Record<Acao['status'], string>> = {
  recusada: 'Recusar este pedido?',
  cancelada: 'Cancelar este pedido?',
};

/**
 * Os pedidos que o tutor fez (como cliente) e os que recebeu (como prestador). O prestador
 * aceita, recusa e conclui; depois de concluído, o cliente avalia.
 */
@Component({
  selector: 'app-pedidos',
  imports: [RouterLink, Avatar, Estrelas],
  templateUrl: './pedidos.html',
  styleUrl: './pedidos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pedidos {
  private readonly service = inject(ServicosService);
  private readonly router = inject(Router);

  /** Query `?papel=`: `prestador` abre direto nos pedidos recebidos. */
  readonly papelInicial = input<string | undefined>(undefined, { alias: 'papel' });

  protected readonly papel = linkedSignal<Papel>(() =>
    this.papelInicial() === 'prestador' ? 'prestador' : 'cliente',
  );
  private readonly lista = signal<Contratacao[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly ocupado = signal<number | null>(null);
  private busca = 0;

  /** Pedido com o formulário de avaliação aberto. */
  protected readonly avaliando = signal<number | null>(null);
  protected readonly nota = signal(0);
  protected readonly comentario = signal('');
  protected readonly estrelas = [1, 2, 3, 4, 5];

  protected readonly pedidos = computed(() =>
    this.lista().map((c) => {
      const outro = c.papel === 'cliente' ? c.prestador : c.cliente;
      const contato = c.papel === 'cliente' ? c.prestador.contato : c.contato;
      return {
        ...c,
        outro,
        tipoLabel: rotuloServico(c.prestador.tipo),
        statusLabel: STATUS_CONTRATACAO[c.status],
        quando: formatarDataHora(c.inicio),
        ate: c.fim && formatarDataHora(c.fim),
        nomesPets: nomesPets(c.pets),
        contato,
        telefone: linksTelefone(contato),
        acoes: this.acoes(c),
        podeAvaliar: c.papel === 'cliente' && c.status === 'concluida',
        aguardandoInicio:
          c.papel === 'prestador' &&
          c.status === 'aceita' &&
          !this.ehPasseio(c) &&
          !this.comecou(c),
        aoVivo: this.linkAoVivo(c),
      };
    }),
  );

  constructor() {
    effect(() => {
      const papel = this.papel();
      untracked(() => this.carregar(papel));
    });
  }

  protected trocarPapel(papel: Papel): void {
    this.papel.set(papel);
    this.avaliando.set(null);
    // Mantém a aba na URL, para voltar nela depois.
    this.router.navigate([], { queryParams: { papel }, replaceUrl: true });
  }

  protected async executar(pedido: Contratacao, acao: Acao): Promise<void> {
    const confirmacao = CONFIRMACOES[acao.status];
    if (confirmacao && !confirm(confirmacao)) return;
    await this.atualizar(pedido.id, () => this.service.mudarStatus(pedido.id, acao.status));
  }

  protected abrirAvaliacao(pedido: Contratacao): void {
    this.avaliando.set(pedido.id);
    this.nota.set(pedido.avaliacao?.nota ?? 0);
    this.comentario.set(pedido.avaliacao?.comentario ?? '');
  }

  protected async enviarAvaliacao(pedido: Contratacao): Promise<void> {
    if (!this.nota()) {
      this.erro.set('Escolha de 1 a 5 estrelas.');
      return;
    }
    await this.atualizar(pedido.id, () =>
      this.service.avaliar(pedido.id, this.nota(), this.comentario().trim()),
    );
    if (!this.erro()) this.avaliando.set(null);
  }

  /** O que quem está logado pode fazer com o pedido agora (as mesmas regras da API). */
  private acoes(c: Contratacao): Acao[] {
    if (c.papel === 'prestador') {
      if (c.status === 'pendente') {
        return [
          { status: 'aceita', label: 'Aceitar' },
          { status: 'recusada', label: 'Recusar', perigo: true },
        ];
      }
      if (c.status === 'aceita') {
        // O passeio começa e termina na tela ao vivo, não aqui.
        const podeConcluir = !this.ehPasseio(c) && this.comecou(c);
        return [
          ...(podeConcluir ? [{ status: 'concluida', label: 'Concluir' } as Acao] : []),
          { status: 'cancelada', label: 'Cancelar', perigo: true },
        ];
      }
      return [];
    }
    return c.status === 'pendente' || c.status === 'aceita'
      ? [{ status: 'cancelada', label: 'Cancelar pedido', perigo: true }]
      : [];
  }

  /** Atalho para a tela do passeio ao vivo, quando faz sentido. */
  private linkAoVivo(c: Contratacao): string | null {
    if (!this.ehPasseio(c)) return null;
    if (c.status === 'aceita')
      return c.papel === 'prestador' ? 'Iniciar passeio' : 'Acompanhar ao vivo';
    if (c.status === 'em_andamento') {
      return c.papel === 'prestador' ? 'Continuar passeio' : 'Acompanhar ao vivo';
    }
    return c.status === 'concluida' && c.iniciadoEm ? 'Ver trajeto' : null;
  }

  private ehPasseio(c: Contratacao): boolean {
    return c.prestador.tipo === 'passeador';
  }

  private comecou(c: Contratacao): boolean {
    return Date.parse(c.inicio) <= Date.now();
  }

  private async atualizar(id: number, fazer: () => Promise<Contratacao>): Promise<void> {
    this.erro.set(null);
    this.ocupado.set(id);
    try {
      const salvo = await fazer();
      this.lista.update((lista) => lista.map((c) => (c.id === salvo.id ? salvo : c)));
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro, 'Não foi possível atualizar agora. Tente novamente.'));
    } finally {
      this.ocupado.set(null);
    }
  }

  private async carregar(papel: Papel): Promise<void> {
    const busca = ++this.busca;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.pedidos(papel);
      if (busca === this.busca) this.lista.set(lista);
    } catch (erro) {
      if (busca === this.busca) {
        this.erro.set(mensagemDeErro(erro, 'Não foi possível carregar os pedidos agora.'));
      }
    } finally {
      if (busca === this.busca) this.carregando.set(false);
    }
  }
}
