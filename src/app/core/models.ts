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

/** Perfil público de um pet, visto por qualquer tutor (`/pets/:id`). */
export interface PerfilPet {
  pet: Pet;
  tutor: string;
  fotoTutor: string | null;
  /** Se o pet é de quem está logado. */
  meu: boolean;
  totalPasseios: number;
  kmTotal: number;
  /** Quantas fotos há no álbum. */
  totalFotos: number;
}

/** Foto do álbum do pet: vem de um passeio em que ele foi. */
export interface FotoAlbum {
  /** Caminho da foto na API (`/fotos/<id>`); use `urlFoto` para exibir. */
  foto: string;
  passeioId: number;
  /** Data do passeio, em ISO 8601. */
  data: string;
}

export interface PaginaAlbum {
  itens: FotoAlbum[];
  /** Mande como `antesDe` para a próxima página; null quando acabou. */
  proximoCursor: string | null;
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

export type TipoServico = 'passeador' | 'anfitriao' | 'petshop';

/** Item da tabela de preços, ex. "Passeio de 30 min": 2500 (R$ 25,00). */
export interface Preco {
  descricao: string;
  valorCentavos: number;
}

/** Quem oferece um serviço: passeador, anfitrião (hospedagem) ou petshop (banho e tosa). */
export interface Prestador {
  id: number;
  tipo: TipoServico;
  nome: string;
  descricao: string;
  contato: string;
  bairro: string;
  /** Região de atendimento. */
  posicao: LatLng;
  precos: Preco[];
  /** Caminhos das fotos na API (`/fotos/<id>`), na ordem; use `urlFoto` para exibir. */
  fotos: string[];
  /** Foto de perfil de quem cadastrou. */
  fotoUsuario: string | null;
  /** Pausado não aparece na busca nem recebe pedidos. */
  ativo: boolean;
  /** De 1 a 5, com uma casa; null sem avaliações. */
  notaMedia: number | null;
  totalAvaliacoes: number;
  /** Se quem está logado cadastrou. */
  meu: boolean;
}

/** Item da busca por raio, com a distância até o centro da busca. */
export interface PrestadorProximo extends Prestador {
  distanciaKm: number;
}

export interface Avaliacao {
  nota: number;
  comentario: string;
  /** Data em ISO 8601. */
  data: string;
  cliente: string;
  fotoCliente: string | null;
}

export type StatusContratacao = 'pendente' | 'aceita' | 'recusada' | 'cancelada' | 'concluida';

/** Pedido de um tutor (cliente) a um prestador. */
export interface Contratacao {
  id: number;
  status: StatusContratacao;
  /** Data e hora em ISO 8601. */
  inicio: string;
  /** Só na hospedagem. */
  fim: string | null;
  /** Telefone do cliente. */
  contato: string;
  mensagem: string;
  criadoEm: string;
  /** Se quem está logado fez (`cliente`) ou recebeu (`prestador`) o pedido. */
  papel: 'cliente' | 'prestador';
  cliente: { nome: string; foto: string | null };
  prestador: Pick<Prestador, 'id' | 'tipo' | 'nome' | 'contato'> & { foto: string | null };
  pets: (PetDoPasseio & Pick<Pet, 'especie' | 'porte'>)[];
  avaliacao: Pick<Avaliacao, 'nota' | 'comentario'> | null;
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

/** "Cachorro · Vira-lata · 4 anos · porte médio". */
export function descricaoPet(pet: Pick<Pet, 'especie' | 'raca' | 'idadeAnos' | 'porte'>): string {
  const especie = ESPECIES.find((e) => e.id === pet.especie)?.label ?? '';
  const porte = PORTES.find((p) => p.id === pet.porte)?.label.toLowerCase() ?? '';
  const idade = `${pet.idadeAnos} ${pet.idadeAnos === 1 ? 'ano' : 'anos'}`;
  return [especie, pet.raca, idade, `porte ${porte}`].filter(Boolean).join(' · ');
}

export const TIPOS_SERVICO: readonly { id: TipoServico; label: string; plural: string }[] = [
  { id: 'passeador', label: 'Passeador', plural: 'Passeadores' },
  { id: 'anfitriao', label: 'Hospedagem', plural: 'Hospedagem' },
  { id: 'petshop', label: 'Banho e tosa', plural: 'Banho e tosa' },
];

export const STATUS_CONTRATACAO: Record<StatusContratacao, string> = {
  pendente: 'Aguardando resposta',
  aceita: 'Aceito',
  recusada: 'Recusado',
  cancelada: 'Cancelado',
  concluida: 'Concluído',
};

export function rotuloServico(tipo: TipoServico): string {
  return TIPOS_SERVICO.find((t) => t.id === tipo)?.label ?? tipo;
}
