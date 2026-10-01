import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_URL = environment.apiUrl.replace(/\/$/, '');

/** Corpo dos erros da API: `{ timestamp, status, erro, mensagem, campos? }`. */
interface CorpoErro {
  mensagem?: unknown;
  campos?: Record<string, string>;
}

/**
 * Mensagem para mostrar ao tutor. Usa a da API nos erros 4xx (ex.: "E-mail ou senha
 * incorretos"); falha de rede ou do servidor fica com o texto padrão da tela.
 */
export function mensagemDeErro(erro: unknown, padrao: string): string {
  if (!(erro instanceof HttpErrorResponse) || erro.status < 400 || erro.status >= 500) {
    return padrao;
  }
  const corpo = (erro.error ?? {}) as CorpoErro;
  const doCampo = corpo.campos && Object.values(corpo.campos)[0];
  if (doCampo) return doCampo;
  return typeof corpo.mensagem === 'string' ? corpo.mensagem : padrao;
}
