/** Coordenada no formato [latitude, longitude], o mesmo usado pelo Leaflet. */
export type LatLng = [number, number];

export type Especie = 'cachorro' | 'gato' | 'outro';
export type Porte = 'pequeno' | 'medio' | 'grande';

export interface Perfil {
  tutor: string;
  email: string;
  pet: string;
  especie: Especie;
  raca: string;
  idadeAnos: number;
  porte: Porte;
  bio: string;
  metaSemanalKm: number;
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
  /** "<tutor> e <pet>", ex. "Ana e Mel". */
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

export interface Passeio {
  id: number;
  pet: string;
  tutor: string;
  /** Data e hora em ISO 8601. */
  data: string;
  rotaId: number | null;
  rotaNome: string;
  pontos: LatLng[];
  distanciaKm: number;
  duracaoMin: number;
  texto: string;
  curtidas: number;
  curtido: boolean;
  meu: boolean;
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
