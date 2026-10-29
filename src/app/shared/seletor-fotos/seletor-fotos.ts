import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { urlFoto } from '../../core/api';
import { LADO_FOTO_PASSEIO, REDUZIR_IMAGEM, TIPOS_ACEITOS } from '../../core/imagem';

/** O mesmo limite da API para os passeios. */
export const MAX_FOTOS = 4;

/**
 * Fotos de um passeio (ou de um serviço), com pré-visualização e remoção. As novas entram já reduzidas, em
 * data URL; as que o passeio já tem ficam pelo caminho da API (`/fotos/<id>`).
 */
@Component({
  selector: 'app-seletor-fotos',
  templateUrl: './seletor-fotos.html',
  styleUrl: './seletor-fotos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorFotos {
  private readonly reduzirImagem = inject(REDUZIR_IMAGEM);

  readonly fotos = model.required<string[]>();
  /** Verdadeiro enquanto reduz as fotos escolhidas; quem usa deve esperar para enviar. */
  readonly preparando = model(false);
  readonly maxFotos = input(MAX_FOTOS);
  readonly legenda = input('Fotos do passeio');

  protected readonly tiposAceitos = TIPOS_ACEITOS;
  protected readonly erro = signal<string | null>(null);

  protected src(foto: string): string | null {
    return foto.startsWith('data:') ? foto : urlFoto(foto);
  }

  protected async escolhidas(seletor: HTMLInputElement): Promise<void> {
    const arquivos = [...(seletor.files ?? [])];
    // Limpa para que escolher o mesmo arquivo de novo também dispare o `change`.
    seletor.value = '';
    this.erro.set(null);
    const vagas = this.maxFotos() - this.fotos().length;
    if (!arquivos.length || vagas <= 0) return;
    if (arquivos.length > vagas) {
      this.erro.set(`Cabem até ${this.maxFotos()} fotos; ficaram as primeiras.`);
    }

    this.preparando.set(true);
    try {
      for (const arquivo of arquivos.slice(0, vagas)) {
        const imagem = await this.reduzirImagem(arquivo, LADO_FOTO_PASSEIO);
        this.fotos.update((lista) => [...lista, imagem]);
      }
    } catch (erro) {
      // Erros da redução (arquivo que não é imagem) já vêm com a mensagem para o tutor.
      this.erro.set(
        erro instanceof Error ? erro.message : 'Não foi possível usar essa foto. Tente outra.',
      );
    } finally {
      this.preparando.set(false);
    }
  }

  protected remover(indice: number): void {
    this.erro.set(null);
    this.fotos.update((lista) => lista.filter((_, i) => i !== indice));
  }
}
