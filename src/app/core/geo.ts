import { LatLng } from './models';

const RAIO_TERRA_KM = 6371;

/** Centro padrão do mapa enquanto não sabemos onde o tutor está (Rio de Janeiro). */
export const CENTRO_PADRAO: LatLng = [-22.9365, -43.1795];

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/** Distância em km entre dois pontos pela fórmula de haversine. */
export function distanciaEntre([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const dLat = radianos(lat2 - lat1);
  const dLng = radianos(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(lat1)) * Math.cos(radianos(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
}

/** Soma das distâncias entre pontos consecutivos de um trajeto. */
export function distanciaTrajeto(pontos: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    total += distanciaEntre(pontos[i - 1], pontos[i]);
  }
  return total;
}

/** Link gratuito de rota a pé até o destino, no site do OpenStreetMap. */
export function linkComoChegar([lat, lng]: LatLng): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lng}`;
}

/** Por que não deu para saber onde o tutor está. */
export type FalhaLocalizacao = 'indisponivel' | 'negada' | 'falhou';

/** Posição atual pelo GPS do navegador; rejeita com o motivo da falha. */
export function localizar(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject('indisponivel' satisfies FalhaLocalizacao);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.latitude, coords.longitude]),
      (erro) =>
        reject((erro.code === erro.PERMISSION_DENIED ? 'negada' : 'falhou') satisfies FalhaLocalizacao),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
