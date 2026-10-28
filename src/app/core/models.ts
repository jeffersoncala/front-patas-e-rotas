/** Coordenada no formato [latitude, longitude], o mesmo usado pelo Leaflet. */
export type LatLng = [number, number];

export type Especie = 'cachorro' | 'gato' | 'outro';
export type Porte = 'pequeno' | 'medio' | 'grande';

export interface Pet {
  id: number;
  nome: string;
  especie: Especie;
  raca: string;
  idadeAnos: number;
  porte: Porte;
  bio: string;
  /** Caminho da foto na API (`/fotos/<id>`); use `urlFoto` para exibir. */
  foto: string | null;
}

export type DadosPet = Omit<Pet, 'id' | 'foto'>;

export interface Perfil {
  tutor: string;
  email: string;
  /** Caminho da foto na API (`/fotos/<id>`); use `urlFoto` para exibir. */
  foto: string | null;
  metaSemanalKm: number;
  /** Na ordem em que foram cadastrados; vazio numa conta nova. */
  pets: Pet[];
}

export interface Encontro {
  id: number;
  titulo: string;
  descricao: string;
  local: string;
  posicao: LatLng;
  /** Data e hora em ISO 8601. */
  data: string;
  confirmados: number;
  vou: boolean;
  /** Tutor e pets, ex. "Ana e Mel" ou "Ana, Mel e Thor". */
  organizador: string;
  /** Se quem está logado organizou o encontro. */
  meu: boolean;
}

export interface Rota {
  id: number;
  nome: string;
  bairro: string;
  descricao: string;
  pontos: LatLng[];
  /** Calculada pela API a partir dos pontos. */
  distanciaKm: number;
  duracaoMin: number;
  favorita: boolean;
  /** Quantos tutores favoritaram. */
  favoritadas: number;
  /** Se quem está logado criou a rota. */
  minha: boolean;
}

/** Pet que foi num passeio. */
export type PetDoPasseio = Pick<Pet, 'id' | 'nome' | 'foto'>;

export interface Passeio {
  id: number;
  /** Vazio se os pets já foram removidos do perfil do tutor. */
  pets: PetDoPasseio[];
  tutor: string;
  fotoTutor: string | null;
  /** Data e hora em ISO 8601. */
  data: string;
  rotaId: number | null;
  rotaNome: string;
  pontos: LatLng[];
  distanciaKm: number;
  duracaoMin: number;
  texto: string;
  /** Caminhos das fotos na API (`/fotos/<id>`), na ordem; use `urlFoto` para exibir. */
  fotos: string[];
  curtidas: number;
  curtido: boolean;
  meu: boolean;
}

export interface Desaparecido {
  id: number;
  nome: string;
  especie: Especie;
  raca: string;
  porte: Porte;
  descricao: string;
  /** Telefone, WhatsApp ou outro jeito de falar com quem cadastrou. */
  contato: string;
  /** Caminho da foto na API (`/fotos/<id>`); use `urlFoto` para exibir. */
  foto: string | null;
  /** Onde o pet foi visto pela última vez. */
  posicao: LatLng;
  /** Data e hora em ISO 8601. */
  vistoEm: string;
  encontrado: boolean;
  /** Quem cadastrou. */
  tutor: string;
  /** Se quem está logado cadastrou. */
  meu: boolean;
}

/** Item da busca por raio, com a distância até o centro da busca. */
export interface DesaparecidoProximo extends Desaparecido {
  distanciaKm: number;
}

/** Números da home e do perfil, vindos de `/perfil/resumo`. */
export interface ResumoPerfil {
  kmSemana: number;
  passeiosSemana: number;
  kmTotal: number;
  totalPasseios: number;
  /** Encontros futuros com presença confirmada. */
  encontrosConfirmados: number;
}

export const ESPECIES: readonly { id: Especie; label: string }[] = [
  { id: 'cachorro', label: 'Cachorro' },
  { id: 'gato', label: 'Gato' },
  { id: 'outro', label: 'Outro' },
];

export const PORTES: readonly { id: Porte; label: string }[] = [
  { id: 'pequeno', label: 'Pequeno' },
  { id: 'medio', label: 'Médio' },
  { id: 'grande', label: 'Grande' },
];

/** "Mel", "Mel e Thor", "Mel, Thor e Pipoca". */
export function juntarNomes(nomes: readonly string[]): string {
  return nomes.length < 2 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** Nomes dos pets do perfil ou do passeio, já juntos para exibir. */
export function nomesPets(pets: readonly Pick<Pet, 'nome'>[]): string {
  return juntarNomes(pets.map((p) => p.nome));
}
