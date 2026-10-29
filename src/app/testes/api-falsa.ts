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
import { distanciaEntre, distanciaTrajeto } from '../core/geo';
import {
  Acompanhamento,
  Avaliacao,
  Contratacao,
  DadosPet,
  Desaparecido,
  Encontro,
  LatLng,
  Passeio,
  Perfil,
  Pet,
  Prestador,
  ResumoPerfil,
  Rota,
  juntarNomes,
} from '../core/models';
import {
  AVALIACOES_EXEMPLO,
  CONTRATACOES_EXEMPLO,
  DESAPARECIDOS_EXEMPLO,
  ENCONTROS_EXEMPLO,
  PASSEIOS_EXEMPLO,
  PRESTADORES_EXEMPLO,
  ROTAS_EXEMPLO,
  TRAJETOS_EXEMPLO,
} from './dados-exemplo';

export const PERFIL_EXEMPLO: Perfil = {
  tutor: 'Jeff',
  email: 'tutor@exemplo.com',
  foto: null,
  metaSemanalKm: 15,
  pets: [
    {
      id: 1,
      nome: 'Bolota',
      especie: 'cachorro',
      raca: 'Vira-lata caramelo',
      idadeAnos: 4,
      porte: 'medio',
      bio: 'Especialista em cheirar postes e fazer amizade com qualquer um que tenha petisco.',
      foto: null,
    },
  ],
};

/** Grava uma sessão aberta, como se o tutor já tivesse entrado. */
export function entrarComoExemplo(perfil: Perfil = PERFIL_EXEMPLO): void {
  localStorage.setItem(
    'pataserotas.sessao',
    JSON.stringify({
      accessToken: 'token-teste',
      refreshToken: 'refresh-teste',
      lembrar: true,
      perfil,
    }),
  );
}

interface Banco {
  perfil: Perfil;
  rotas: Rota[];
  encontros: Encontro[];
  passeios: Passeio[];
  desaparecidos: Desaparecido[];
  prestadores: Prestador[];
  avaliacoes: Record<number, Avaliacao[]>;
  contratacoes: Contratacao[];
  trajetos: Record<number, { pontos: LatLng[]; posicaoEm: string | null }>;
}

type Resposta = { status: number; body: unknown };

const SETE_DIAS = 7 * 24 * 60 * 60_000;
const ok = (body: unknown, status = 200): Resposta => ({ status, body });
const naoEncontrado: Resposta = { status: 404, body: { status: 404, mensagem: 'Não encontrado' } };
const proximoId = (lista: { id: number }[]) => Math.max(0, ...lista.map((i) => i.id)) + 1;
const maisRecentes = (lista: Passeio[]) => [...lista].sort((a, b) => b.data.localeCompare(a.data));

/**
 * HttpClient que responde na hora, sem rede, com os dados de exemplo e o mesmo contrato
 * da API (`pataserotas-backend`). Cada chamada começa com um banco novo, com o `perfil` dado.
 */
export function provideApiFalsa(perfil: Perfil = PERFIL_EXEMPLO): EnvironmentProviders {
  const banco: Banco = structuredClone({
    perfil,
    rotas: ROTAS_EXEMPLO,
    encontros: ENCONTROS_EXEMPLO,
    passeios: PASSEIOS_EXEMPLO,
    desaparecidos: DESAPARECIDOS_EXEMPLO,
    prestadores: PRESTADORES_EXEMPLO,
    avaliacoes: AVALIACOES_EXEMPLO,
    contratacoes: CONTRATACOES_EXEMPLO,
    trajetos: TRAJETOS_EXEMPLO,
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
  // "/perfil/pets/3/foto" vira "PATCH /perfil/pets/:id/foto", com id = 3.
  const partes = req.url.slice(API_URL.length).split('/').filter(Boolean);
  const numerico = (parte: string) => /^\d+$/.test(parte);
  const id = Number(partes.find(numerico));
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  const rota = `${req.method} /${partes.map((p) => (numerico(p) ? ':id' : p)).join('/')}`;
  const { perfil } = banco;

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
      banco.perfil = { ...perfil, ...corpo };
      return ok(banco.perfil);
    case 'PUT /perfil/foto':
      perfil.foto = `/fotos/tutor-${Date.now()}`;
      return ok(perfil);
    case 'DELETE /perfil/foto':
      perfil.foto = null;
      return ok(perfil);
    case 'POST /perfil/pets':
      perfil.pets.push({
        ...(corpo as unknown as DadosPet),
        id: proximoId(perfil.pets),
        foto: null,
      });
      return ok(perfil, 201);
    case 'PATCH /perfil/pets/:id':
      return achar(perfil.pets, id, (pet) => {
        Object.assign(pet, corpo);
        return ok(perfil);
      });
    case 'DELETE /perfil/pets/:id':
      return achar(perfil.pets, id, () => {
        perfil.pets = perfil.pets.filter((p) => p.id !== id);
        return ok(perfil);
      });
    case 'PUT /perfil/pets/:id/foto':
    case 'DELETE /perfil/pets/:id/foto':
      return achar(perfil.pets, id, (pet) => {
        pet.foto = req.method === 'PUT' ? `/fotos/pet-${id}-${Date.now()}` : null;
        return ok(perfil);
      });
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
        organizador: juntarNomes([perfil.tutor, ...perfil.pets.map((p) => p.nome)]),
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
        petIds?: number[];
        fotos?: string[];
      };
      const pets = perfil.pets.filter((p) => !dados.petIds || dados.petIds.includes(p.id));
      const rotaDoPasseio = banco.rotas.find((r) => r.id === dados.rotaId);
      const novo: Passeio = {
        pontos: dados.pontos,
        duracaoMin: dados.duracaoMin,
        texto: dados.texto,
        id: proximoId(banco.passeios),
        fotos: (dados.fotos ?? []).map((_, i) => `/fotos/passeio-${Date.now()}-${i}`),
        pets: pets.map(({ id, nome, foto }) => ({ id, nome, foto })),
        tutor: perfil.tutor,
        fotoTutor: perfil.foto,
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
    case 'GET /passeios/:id':
      return achar(banco.passeios, id, (p) => ok(p));
    case 'PATCH /passeios/:id':
      return achar(banco.passeios, id, (p) => {
        const { fotos, ...campos } = corpo as Partial<Passeio>;
        Object.assign(p, campos);
        if (fotos) {
          // Como a API: as que ficam vêm pelo caminho, as novas em data URL.
          p.fotos = fotos.map((f, i) =>
            f.startsWith('data:') ? `/fotos/passeio-${Date.now()}-${i}` : f,
          );
        }
        return ok(p);
      });
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

    case 'GET /pets/:id': {
      const pet = petPorId(banco, id);
      if (!pet) return naoEncontrado;
      const passeios = passeiosDoPet(banco, id);
      return ok({
        pet: pet.dados,
        tutor: pet.tutor,
        fotoTutor: pet.fotoTutor,
        meu: pet.meu,
        totalPasseios: passeios.length,
        kmTotal: passeios.reduce((total, p) => total + p.distanciaKm, 0),
        totalFotos: passeios.reduce((total, p) => total + p.fotos.length, 0),
      });
    }
    case 'GET /pets/:id/album': {
      if (!petPorId(banco, id)) return naoEncontrado;
      // Cursor simplificado: a posição na lista completa.
      const inicio = Number(req.params.get('antesDe') ?? 0);
      const limite = Number(req.params.get('limite') ?? 30);
      const todas = passeiosDoPet(banco, id).flatMap((p) =>
        p.fotos.map((foto) => ({ foto, passeioId: p.id, data: p.data })),
      );
      const fim = inicio + limite;
      return ok({
        itens: todas.slice(inicio, fim),
        proximoCursor: fim < todas.length ? String(fim) : null,
      });
    }

    case 'GET /desaparecidos': {
      const centro: LatLng = [Number(req.params.get('lat')), Number(req.params.get('lng'))];
      const raioKm = Number(req.params.get('raioKm') ?? 5);
      const proximos = banco.desaparecidos
        .filter((d) => !d.encontrado)
        .map((d) => ({ ...d, distanciaKm: distanciaEntre(centro, d.posicao) }))
        .filter((d) => d.distanciaKm <= raioKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
      return ok(proximos);
    }
    case 'POST /desaparecidos': {
      const { foto, ...dados } = corpo as Omit<
        Desaparecido,
        'id' | 'foto' | 'encontrado' | 'tutor' | 'meu'
      > & { foto?: string };
      const novo: Desaparecido = {
        ...dados,
        id: proximoId(banco.desaparecidos),
        foto: foto ? `/fotos/desaparecido-${Date.now()}` : null,
        encontrado: false,
        tutor: perfil.tutor,
        meu: true,
      };
      banco.desaparecidos.push(novo);
      return ok(novo, 201);
    }
    case 'PUT /desaparecidos/:id/encontrado':
      return achar(banco.desaparecidos, id, (d) => {
        if (!d.meu) return { status: 403, body: { status: 403, mensagem: 'Proibido' } };
        d.encontrado = true;
        return ok(d);
      });

    case 'GET /prestadores': {
      const centro: LatLng = [Number(req.params.get('lat')), Number(req.params.get('lng'))];
      const raioKm = Number(req.params.get('raioKm') ?? 10);
      const tipo = req.params.get('tipo');
      const proximos = banco.prestadores
        .filter((p) => p.ativo && (!tipo || p.tipo === tipo))
        .map((p) => ({ ...p, distanciaKm: distanciaEntre(centro, p.posicao) }))
        .filter((p) => p.distanciaKm <= raioKm)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
      return ok(proximos);
    }
    case 'GET /prestadores/meus':
      return ok(banco.prestadores.filter((p) => p.meu));
    case 'GET /prestadores/:id':
      return achar(banco.prestadores, id, (p) => ok(p));
    case 'GET /prestadores/:id/avaliacoes':
      return achar(banco.prestadores, id, () => ok(banco.avaliacoes[id] ?? []));
    case 'POST /prestadores': {
      const { fotos, ...dados } = corpo as Pick<
        Prestador,
        'tipo' | 'nome' | 'descricao' | 'contato' | 'bairro' | 'posicao' | 'precos'
      > & { fotos: string[] };
      if (banco.prestadores.some((p) => p.meu && p.tipo === dados.tipo)) {
        return { status: 409, body: { status: 409, mensagem: 'Você já oferece esse serviço' } };
      }
      const novo: Prestador = {
        ...dados,
        id: proximoId(banco.prestadores),
        fotos: fotos.map((_, i) => `/fotos/prestador-${Date.now()}-${i}`),
        fotoUsuario: perfil.foto,
        ativo: true,
        notaMedia: null,
        totalAvaliacoes: 0,
        meu: true,
      };
      banco.prestadores.push(novo);
      return ok(novo, 201);
    }
    case 'PATCH /prestadores/:id':
      return achar(banco.prestadores, id, (p) => {
        if (!p.meu) return { status: 403, body: { status: 403, mensagem: 'Proibido' } };
        const { fotos, ...campos } = corpo as Partial<Prestador>;
        Object.assign(p, campos);
        if (fotos) {
          // Como a API: as que ficam vêm pelo caminho, as novas em data URL.
          p.fotos = fotos.map((f, i) =>
            f.startsWith('data:') ? `/fotos/prestador-${Date.now()}-${i}` : f,
          );
        }
        return ok(p);
      });
    case 'DELETE /prestadores/:id':
      return achar(banco.prestadores, id, () => {
        banco.prestadores = banco.prestadores.filter((p) => p.id !== id);
        return ok(null, 204);
      });

    case 'GET /contratacoes':
      return ok(
        banco.contratacoes.filter((c) => c.papel === (req.params.get('papel') ?? 'cliente')),
      );
    case 'POST /contratacoes': {
      const dados = corpo as {
        prestadorId: number;
        petIds: number[];
        inicio: string;
        fim?: string;
        contato: string;
        mensagem: string;
      };
      const prestador = banco.prestadores.find((p) => p.id === dados.prestadorId);
      if (!prestador) return naoEncontrado;
      const nova: Contratacao = {
        id: proximoId(banco.contratacoes),
        status: 'pendente',
        inicio: dados.inicio,
        fim: dados.fim ?? null,
        contato: dados.contato,
        mensagem: dados.mensagem,
        criadoEm: new Date().toISOString(),
        iniciadoEm: null,
        finalizadoEm: null,
        papel: 'cliente',
        cliente: { nome: perfil.tutor, foto: perfil.foto },
        prestador: {
          id: prestador.id,
          tipo: prestador.tipo,
          nome: prestador.nome,
          contato: prestador.contato,
          foto: prestador.fotoUsuario,
        },
        pets: perfil.pets
          .filter((p) => dados.petIds.includes(p.id))
          .map(({ id, nome, foto, especie, porte }) => ({ id, nome, foto, especie, porte })),
        avaliacao: null,
      };
      banco.contratacoes.push(nova);
      return ok(nova, 201);
    }
    case 'GET /contratacoes/:id':
      return achar(banco.contratacoes, id, (c) => ok(c));
    case 'PUT /contratacoes/:id/status':
      return achar(banco.contratacoes, id, (c) => {
        const { status } = corpo as Pick<Contratacao, 'status'>;
        if (status === 'em_andamento') c.iniciadoEm = new Date().toISOString();
        if (c.status === 'em_andamento') c.finalizadoEm = new Date().toISOString();
        c.status = status;
        return ok(c);
      });
    case 'POST /contratacoes/:id/posicoes':
      return achar(banco.contratacoes, id, (c) => {
        if (c.status !== 'em_andamento') {
          return { status: 409, body: { status: 409, mensagem: 'Não está em andamento' } };
        }
        const trajeto = (banco.trajetos[id] ??= { pontos: [], posicaoEm: null });
        trajeto.pontos.push(...(corpo as { pontos: LatLng[] }).pontos);
        trajeto.posicaoEm = new Date().toISOString();
        return ok(null, 204);
      });
    case 'GET /contratacoes/:id/acompanhamento':
      return achar(banco.contratacoes, id, (c) => {
        const { pontos, posicaoEm } = banco.trajetos[id] ?? { pontos: [], posicaoEm: null };
        const fim = c.finalizadoEm ? Date.parse(c.finalizadoEm) : Date.now();
        return ok({
          status: c.status,
          iniciadoEm: c.iniciadoEm,
          finalizadoEm: c.finalizadoEm,
          posicaoEm,
          duracaoMin: c.iniciadoEm ? Math.round((fim - Date.parse(c.iniciadoEm)) / 60_000) : 0,
          distanciaKm: distanciaTrajeto(pontos),
          totalPontos: pontos.length,
          pontos: pontos.slice(Number(req.params.get('desde') ?? 0)),
        } satisfies Acompanhamento);
      });
    case 'PUT /contratacoes/:id/avaliacao':
      return achar(banco.contratacoes, id, (c) => {
        if (c.status !== 'concluida') {
          return { status: 409, body: { status: 409, mensagem: 'Ainda não foi concluído' } };
        }
        c.avaliacao = corpo as Pick<Avaliacao, 'nota' | 'comentario'>;
        return ok(c);
      });

    default:
      return naoEncontrado;
  }
}

function achar<T extends { id: number }>(lista: T[], id: number, fazer: (item: T) => Resposta) {
  const item = lista.find((i) => i.id === id);
  return item ? fazer(item) : naoEncontrado;
}

/** Pet do perfil logado ou de outro tutor, montado a partir dos passeios do feed. */
function petPorId(banco: Banco, id: number) {
  const meu = banco.perfil.pets.find((p) => p.id === id);
  if (meu) {
    return { dados: meu, tutor: banco.perfil.tutor, fotoTutor: banco.perfil.foto, meu: true };
  }
  const passeio = banco.passeios.find((p) => p.pets.some((pet) => pet.id === id));
  const doPasseio = passeio?.pets.find((pet) => pet.id === id);
  if (!passeio || !doPasseio) return null;
  const dados: Pet = {
    ...doPasseio,
    especie: 'cachorro',
    raca: '',
    idadeAnos: 3,
    porte: 'medio',
    bio: '',
  };
  return { dados, tutor: passeio.tutor, fotoTutor: passeio.fotoTutor, meu: false };
}

function passeiosDoPet(banco: Banco, id: number): Passeio[] {
  return maisRecentes(banco.passeios.filter((p) => p.pets.some((pet) => pet.id === id)));
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
