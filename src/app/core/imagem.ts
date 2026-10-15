import { InjectionToken } from '@angular/core';

/** Lado maior da foto depois de reduzida, em pixels. Sobra para avatares em telas densas. */
const LADO_MAXIMO = 512;
/** Fotos de passeio aparecem grandes no feed; ainda cabem quatro por passeio no envio. */
export const LADO_FOTO_PASSEIO = 1280;
const QUALIDADE_JPEG = 0.85;

export const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp';

/**
 * Reduz a foto escolhida pelo tutor e devolve um data URL JPEG, pronto para a API.
 * Fotos de celular passam fácil de 5 MB; reduzidas ficam com poucas dezenas de KB.
 * O `createImageBitmap` já aplica a rotação do EXIF, então a foto não sai deitada.
 */
export async function reduzirImagem(arquivo: Blob, lado = LADO_MAXIMO): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não conseguimos abrir essa imagem. Tente outra foto.');
  }
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  // Fundo branco: PNG com transparência ficaria preto no JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALIDADE_JPEG);
}

/** Para os testes trocarem a redução (o jsdom não tem canvas). */
export const REDUZIR_IMAGEM = new InjectionToken<(arquivo: Blob, lado?: number) => Promise<string>>(
  'REDUZIR_IMAGEM',
  { providedIn: 'root', factory: () => reduzirImagem },
);
