import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { EnvironmentProviders } from '@angular/core';
import { of, throwError } from 'rxjs';
import { API_URL } from '../core/api';
import { authInterceptor } from '../core/auth.interceptor';
import { distanciaTrajeto } from '../core/geo';
import { Encontro, Passeio, Perfil, ResumoPerfil, Rota } from '../core/models';
import { ENCONTROS_EXEMPLO, PASSEIOS_EXEMPLO, ROTAS_EXEMPLO } from './dados-exemplo';

export const PERFIL_EXEMPLO: Perfil = {
  tutor: 'Jeff',
  email: 'tutor@exemplo.com',
  pet: 'Bolota',
  especie: 'cachorro',
  raca: 'Vira-lata caramelo',
  idadeAnos: 4,
  porte: 'medio',
  bio: 'Especialista em cheirar postes e fazer amizade com qualquer um que tenha petisco.',
  metaSemanalKm: 15,
};

/** Grava uma sessão aberta, como se o tutor já tivesse entrado. */
export function entrarComoExemplo(perfil: Perfil = PERFIL_EXEMPLO): void {
  localStorage.setItem(
    'pataserotas.sessao',
    JSON.stringify({ accessToken: 'token-teste', refreshToken: 'refresh-teste', lembrar: true, perfil }),
  );
}

interface Banco {
  perfil: Perfil;
  rotas: Rota[];
  encontros: Encontro[];
  passeios: Passeio[];
}

type Resposta = { status: number; body: unknown };

const SETE_DIAS = 7 * 24 * 60 * 60_000;
const ok = (body: unknown, status = 200): Resposta => ({ status, body });
const naoEncontrado: Resposta = { status: 404, body: { status: 404, mensagem: 'Não encontrado' } };
const proximoId = (lista: { id: number }[]) => Math.max(0, ...lista.map((i) => i.id)) + 1;
const maisRecentes = (lista: Passeio[]) => [...lista].sort((a, b) => b.data.localeCompare(a.data));

/**
 * HttpClient que responde na hora, sem rede, com os dados de exemplo e o mesmo contrato
 * da API (`pataserotas-backend`). Cada chamada começa com um banco novo.
 */
export function provideApiFalsa(): EnvironmentProviders {
  const banco: Banco = structuredClone({
    perfil: PERFIL_EXEMPLO,
    rotas: ROTAS_EXEMPLO,
    encontros: ENCONTROS_EXEMPLO,
    passeios: PASSEIOS_EXEMPLO,
  });
  const apiFalsa: HttpInterceptorFn = (req) => {
    // Cópia, como numa resposta de rede: quem recebe não enxerga mudanças posteriores no banco.
    const { status, body } = structuredClone(responder(banco, req));
    return status < 400
      ? of(new HttpResponse({ status, body, url: req.url }))
      : throwError(() => new HttpErrorResponse({ status, error: body, url: req.url }));
  };
  return provideHttpClient(withInterceptors([authInterceptor, apiFalsa]));
}

function responder(banco: Banco, req: HttpRequest<unknown>): Resposta {
  const [recurso, idTexto, acao] = req.url.slice(API_URL.length).split('/').filter(Boolean);
  const id = Number(idTexto);
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  const rota = `${req.method} /${recurso}${idTexto ? (Number.isNaN(id) ? `/${idTexto}` : '/:id') : ''}${acao ? `/${acao}` : ''}`;

  switch (rota) {
    case 'POST /auth/login':
    case 'POST /auth/cadastro':
    case 'POST /auth/refresh':
      return ok({ accessToken: 'token-teste', refreshToken: 'refresh-teste', tokenType: 'Bearer' });
    case 'POST /auth/logout':
      return ok(null, 204);
    case 'POST /auth/recuperar-senha':
      return ok({ mensagem: 'Se o e-mail tiver conta, enviamos um link.' }, 202);

    case 'GET /perfil':
      return ok(banco.perfil);
    case 'PATCH /perfil':
      banco.perfil = { ...banco.perfil, ...corpo };
      return ok(banco.perfil);
    case 'GET /perfil/resumo':
      return ok(resumo(banco));

    case 'GET /rotas':
      return ok(banco.rotas);
    case 'GET /rotas/:id':
      return achar(banco.rotas, id, (r) => ok(r));
    case 'POST /rotas': {
      const nova = {
        ...(corpo as Pick<Rota, 'nome' | 'bairro' | 'descricao' | 'pontos' | 'duracaoMin'>),
        id: proximoId(banco.rotas),
        favorita: true,
        favoritadas: 1,
        minha: true,
      };
      const criada: Rota = { ...nova, distanciaKm: distanciaTrajeto(nova.pontos) };
      banco.rotas.push(criada);
      return ok(criada, 201);
    }
    case 'PUT /rotas/:id/favorita':
    case 'DELETE /rotas/:id/favorita':
      return achar(banco.rotas, id, (r) => {
        const favorita = req.method === 'PUT';
        if (r.favorita !== favorita) {
          r.favoritadas += favorita ? 1 : -1;
          r.favorita = favorita;
        }
        return ok(r);
      });
    case 'GET /rotas/:id/passeios':
      return achar(banco.rotas, id, () =>
        ok(maisRecentes(banco.passeios.filter((p) => p.rotaId === id))),
      );

    case 'GET /encontros':
      return ok(banco.encontros);
    case 'GET /encontros/:id':
      return achar(banco.encontros, id, (e) => ok(e));
    case 'POST /encontros': {
      const novo: Encontro = {
        ...(corpo as Pick<Encontro, 'titulo' | 'descricao' | 'local' | 'posicao' | 'data'>),
        id: proximoId(banco.encontros),
        confirmados: 1,
        vou: true,
        organizador: `${banco.perfil.tutor} e ${banco.perfil.pet}`,
        meu: true,
      };
      banco.encontros.push(novo);
      return ok(novo, 201);
    }
    case 'PUT /encontros/:id/presenca':
    case 'DELETE /encontros/:id/presenca':
      return achar(banco.encontros, id, (e) => {
        const vou = req.method === 'PUT';
        if (e.vou !== vou) {
          e.confirmados += vou ? 1 : -1;
          e.vou = vou;
        }
        return ok(e);
      });

    case 'GET /passeios': {
      const soMeus = req.params.get('autor') === 'eu';
      const itens = maisRecentes(banco.passeios.filter((p) => !soMeus || p.meu));
      return ok({ itens, proximoCursor: null });
    }
    case 'POST /passeios': {
      const dados = corpo as Pick<Passeio, 'pontos' | 'duracaoMin' | 'texto'> & {
        rotaId?: number;
        rotaNome?: string;
      };
      const rotaDoPasseio = banco.rotas.find((r) => r.id === dados.rotaId);
      const novo: Passeio = {
        pontos: dados.pontos,
        duracaoMin: dados.duracaoMin,
        texto: dados.texto,
        id: proximoId(banco.passeios),
        pet: banco.perfil.pet,
        tutor: banco.perfil.tutor,
        data: new Date().toISOString(),
        rotaId: rotaDoPasseio?.id ?? null,
        rotaNome: rotaDoPasseio?.nome ?? dados.rotaNome ?? 'Passeio livre',
        distanciaKm: distanciaTrajeto(dados.pontos),
        curtidas: 0,
        curtido: false,
        meu: true,
      };
      banco.passeios.push(novo);
      return ok(novo, 201);
    }
    case 'PUT /passeios/:id/curtida':
    case 'DELETE /passeios/:id/curtida':
      return achar(banco.passeios, id, (p) => {
        const curtido = req.method === 'PUT';
        if (p.curtido !== curtido) {
          p.curtidas += curtido ? 1 : -1;
          p.curtido = curtido;
        }
        return ok(p);
      });

    default:
      return naoEncontrado;
  }
}

function achar<T extends { id: number }>(lista: T[], id: number, fazer: (item: T) => Resposta) {
  const item = lista.find((i) => i.id === id);
  return item ? fazer(item) : naoEncontrado;
}

function resumo({ passeios, encontros }: Banco): ResumoPerfil {
  const meus = passeios.filter((p) => p.meu);
  const semana = meus.filter((p) => Date.parse(p.data) >= Date.now() - SETE_DIAS);
  const km = (lista: Passeio[]) => lista.reduce((total, p) => total + p.distanciaKm, 0);
  return {
    kmSemana: km(semana),
    passeiosSemana: semana.length,
    kmTotal: km(meus),
    totalPasseios: meus.length,
    encontrosConfirmados: encontros.filter((e) => e.vou).length,
  };
}
