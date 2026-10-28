const DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const MES = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

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
