import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_URL } from './api';
import { DadosPet, Perfil } from './models';

const CHAVE_SESSAO = 'pataserotas.sessao';

export interface DadosCadastro {
  tutor: string;
  email: string;
  senha: string;
  /** Foto opcional, em data URL (como a de `reduzirImagem`). */
  fotoTutor?: string;
}

/** Resposta de `/auth/login`, `/auth/cadastro` e `/auth/refresh`. */
interface RespostaLogin {
  accessToken: string;
  refreshToken: string;
}

interface Sessao {
  accessToken: string;
  refreshToken: string;
  /** Com "lembrar de mim" a sessão fica no localStorage; sem, só até fechar a aba. */
  lembrar: boolean;
  /** Guardado junto para a tela já abrir com o nome do pet enquanto a API responde. */
  perfil: Perfil | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _sessao = signal<Sessao | null>(lerSessao());
  private readonly aoEncerrar: (() => void)[] = [];
  private renovacao: Promise<string | null> | null = null;

  readonly perfil = computed(() => this._sessao()?.perfil ?? null);
  readonly autenticado = computed(() => this._sessao() !== null);
  readonly accessToken = computed(() => this._sessao()?.accessToken ?? null);

  async entrar(email: string, senha: string, lembrar = true): Promise<void> {
    const login = await firstValueFrom(
      this.http.post<RespostaLogin>(`${API_URL}/auth/login`, { email, password: senha }),
    );
    await this.abrirSessao(login, lembrar);
  }

  async cadastrar({ senha, ...dados }: DadosCadastro): Promise<void> {
    const login = await firstValueFrom(
      this.http.post<RespostaLogin>(`${API_URL}/auth/cadastro`, { ...dados, password: senha }),
    );
    await this.abrirSessao(login, true);
  }

  async recuperarSenha(email: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/auth/recuperar-senha`, { email }));
  }

  /** Atualiza o perfil guardado com o que está na API. */
  async carregarPerfil(): Promise<void> {
    const perfil = await firstValueFrom(this.http.get<Perfil>(`${API_URL}/perfil`));
    this.atualizarSessao({ perfil });
  }

  async atualizarPerfil(mudancas: Partial<Pick<Perfil, 'tutor' | 'metaSemanalKm'>>): Promise<void> {
    await this.aplicar(this.http.patch<Perfil>(`${API_URL}/perfil`, mudancas));
  }

  /** `imagem` é um data URL, como o de `reduzirImagem`. */
  async trocarFoto(imagem: string): Promise<void> {
    await this.aplicar(this.http.put<Perfil>(`${API_URL}/perfil/foto`, { imagem }));
  }

  async removerFoto(): Promise<void> {
    await this.aplicar(this.http.delete<Perfil>(`${API_URL}/perfil/foto`));
  }

  async adicionarPet(dados: DadosPet): Promise<void> {
    await this.aplicar(this.http.post<Perfil>(`${API_URL}/perfil/pets`, dados));
  }

  async atualizarPet(id: number, mudancas: Partial<DadosPet>): Promise<void> {
    await this.aplicar(this.http.patch<Perfil>(`${API_URL}/perfil/pets/${id}`, mudancas));
  }

  async removerPet(id: number): Promise<void> {
    await this.aplicar(this.http.delete<Perfil>(`${API_URL}/perfil/pets/${id}`));
  }

  async trocarFotoPet(id: number, imagem: string): Promise<void> {
    await this.aplicar(this.http.put<Perfil>(`${API_URL}/perfil/pets/${id}/foto`, { imagem }));
  }

  async removerFotoPet(id: number): Promise<void> {
    await this.aplicar(this.http.delete<Perfil>(`${API_URL}/perfil/pets/${id}/foto`));
  }

  sair(): void {
    const token = this.accessToken();
    if (token) {
      // Melhor esforço: mesmo se a API não responder, a sessão local é encerrada.
      this.http
        .post(`${API_URL}/auth/logout`, null, { headers: { Authorization: `Bearer ${token}` } })
        .subscribe({ error: () => undefined });
    }
    this.encerrar();
  }

  /**
   * Troca o refresh token por um par novo. Chamadas simultâneas (várias requisições
   * recebendo 401 ao mesmo tempo) compartilham a mesma renovação.
   * Devolve o novo access token, ou `null` se a sessão não pôde ser renovada.
   */
  renovarSessao(): Promise<string | null> {
    return (this.renovacao ??= this.pedirRenovacao().finally(() => (this.renovacao = null)));
  }

  /** Para os services limparem o que guardam do usuário quando a sessão acaba. */
  aoSair(limpar: () => void): void {
    this.aoEncerrar.push(limpar);
  }

  private async pedirRenovacao(): Promise<string | null> {
    const sessao = this._sessao();
    if (!sessao) return null;
    try {
      const { accessToken, refreshToken } = await firstValueFrom(
        this.http.post<RespostaLogin>(`${API_URL}/auth/refresh`, {
          refreshToken: sessao.refreshToken,
        }),
      );
      this.atualizarSessao({ accessToken, refreshToken });
      return accessToken;
    } catch {
      this.encerrar();
      return null;
    }
  }

  private async abrirSessao(login: RespostaLogin, lembrar: boolean): Promise<void> {
    this.guardar({
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
      lembrar,
      perfil: null,
    });
    try {
      await this.carregarPerfil();
    } catch (erro) {
      this.encerrar();
      throw erro;
    }
  }

  /** Toda mudança no perfil devolve o perfil inteiro atualizado. */
  private async aplicar(requisicao: Observable<Perfil>): Promise<void> {
    this.atualizarSessao({ perfil: await firstValueFrom(requisicao) });
  }

  private atualizarSessao(mudancas: Partial<Sessao>): void {
    const atual = this._sessao();
    if (atual) this.guardar({ ...atual, ...mudancas });
  }

  private guardar(sessao: Sessao): void {
    this._sessao.set(sessao);
    (sessao.lembrar ? localStorage : sessionStorage).setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  }

  private encerrar(): void {
    this._sessao.set(null);
    localStorage.removeItem(CHAVE_SESSAO);
    sessionStorage.removeItem(CHAVE_SESSAO);
    for (const limpar of this.aoEncerrar) limpar();
  }
}

function lerSessao(): Sessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO) ?? localStorage.getItem(CHAVE_SESSAO);
    const sessao = bruto ? (JSON.parse(bruto) as Partial<Sessao>) : null;
    // Descarta sessões sem token, como as da época dos dados de exemplo.
    if (!sessao?.accessToken || !sessao.refreshToken) return null;
    // Perfil guardado antes de existirem vários pets: a API manda o novo logo em seguida.
    if (!Array.isArray(sessao.perfil?.pets)) sessao.perfil = null;
    return sessao as Sessao;
  } catch {
    return null;
  }
}
