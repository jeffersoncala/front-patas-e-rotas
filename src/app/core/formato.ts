const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const MES = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarKm(km: number): string {
  return km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Partes curtas para o "calendarinho" dos cards: { semana: 'sáb', dia: 4, mes: 'out' }. */
export function partesData(iso: string): { semana: string; dia: number; mes: string } {
  const data = new Date(iso);
  return {
    semana: DIA_SEMANA.format(data).replace('.', ''),
    dia: data.getDate(),
    mes: MES.format(data).replace('.', ''),
  };
}

export function formatarDataHora(iso: string): string {
  return DATA_HORA.format(new Date(iso));
}

export function formatarHora(iso: string): string {
  const data = new Date(iso);
  const minutos = data.getMinutes();
  return `${data.getHours()}h${minutos ? String(minutos).padStart(2, '0') : ''}`;
}

/** "agora", "há 20 min", "há 3 h", "há 2 dias". */
export function tempoRelativo(iso: string, agora = Date.now()): string {
  const minutos = Math.round((agora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/** "350 m" abaixo de 1 km, "2,4 km" a partir daí. */
export function formatarDistancia(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${formatarKm(km)} km`;
}

export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** 2500 -> "R$ 25,00". */
export function formatarPreco(centavos: number): string {
  return REAIS.format(centavos / 100);
}

/** "R$ 25,00" -> 2500; aceita "25", "25,5" e "1.200,00". `null` se não for um valor. */
export function lerPreco(texto: string): number | null {
  const limpo = texto
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

/** Links para ligar e chamar no WhatsApp, quando o contato parece um telefone brasileiro. */
export function linksTelefone(contato: string): { tel: string; whatsapp: string } | null {
  const digitos = contato.replace(/\D/g, '');
  const nacional = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (nacional.length < 10 || nacional.length > 11) return null;
  return { tel: `tel:+55${nacional}`, whatsapp: `https://wa.me/55${nacional}` };
}

/** Formato do `<input type="datetime-local">`, no fuso local. */
export function paraDatetimeLocal(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`;
}
