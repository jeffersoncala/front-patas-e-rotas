import { formatarDuracao, formatarKm, tempoRelativo } from './formato';
import { distanciaEntre, distanciaTrajeto } from './geo';

describe('geo', () => {
  it('calcula a distância entre dois pontos', () => {
    // Cristo Redentor → Pão de Açúcar: ~5,7 km em linha reta.
    const km = distanciaEntre([-22.9519, -43.2105], [-22.9492, -43.1545]);
    expect(km).toBeGreaterThan(5.6);
    expect(km).toBeLessThan(5.9);
  });

  it('soma os trechos de um trajeto e trata trajetos curtos', () => {
    expect(distanciaTrajeto([])).toBe(0);
    expect(distanciaTrajeto([[-22.9, -43.1]])).toBe(0);

    const a: [number, number] = [-22.9, -43.1];
    const b: [number, number] = [-22.91, -43.1];
    expect(distanciaTrajeto([a, b, a])).toBeCloseTo(2 * distanciaEntre(a, b), 6);
  });
});

describe('formato', () => {
  it('formata km com uma casa decimal', () => {
    expect(formatarKm(3.26)).toBe('3,3');
  });

  it('descreve há quanto tempo algo aconteceu', () => {
    const agora = Date.parse('2026-01-10T12:00:00Z');
    expect(tempoRelativo('2026-01-10T11:59:40Z', agora)).toBe('agora');
    expect(tempoRelativo('2026-01-10T11:40:00Z', agora)).toBe('há 20 min');
    expect(tempoRelativo('2026-01-10T09:00:00Z', agora)).toBe('há 3 h');
    expect(tempoRelativo('2026-01-09T12:00:00Z', agora)).toBe('ontem');
  });

  it('formata duração em horas e minutos', () => {
    expect(formatarDuracao(45)).toBe('45 min');
    expect(formatarDuracao(90)).toBe('1 h 30 min');
  });
});
