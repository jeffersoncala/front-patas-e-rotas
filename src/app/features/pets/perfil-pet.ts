import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensagemDeErro, urlFoto } from '../../core/api';
import { formatarKm, tempoRelativo } from '../../core/formato';
import { FotoAlbum, PerfilPet as DadosPerfilPet, descricaoPet } from '../../core/models';
import { PetsService } from '../../core/pets.service';
import { Avatar } from '../../shared/avatar/avatar';

type Estado = 'carregando' | 'pronto' | 'nao-encontrado' | 'erro';

@Component({
  selector: 'app-perfil-pet',
  imports: [RouterLink, Avatar],
  templateUrl: './perfil-pet.html',
  styleUrl: './perfil-pet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPet {
  private readonly petsService = inject(PetsService);

  /** Vem do parâmetro `:id` da URL. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly formatarKm = formatarKm;
  protected readonly tempoRelativo = tempoRelativo;
  protected readonly descricaoPet = descricaoPet;
  protected readonly urlFoto = urlFoto;

  protected readonly estado = signal<Estado>('carregando');
  protected readonly perfil = signal<DadosPerfilPet | null>(null);
  protected readonly fotos = signal<FotoAlbum[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly carregandoMais = signal(false);
  protected readonly erroAlbum = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.carregar(this.id());
    });
  }

  protected async carregarMais(): Promise<void> {
    const cursor = this.cursor();
    if (!cursor || this.carregandoMais()) return;
    const id = this.id();
    this.carregandoMais.set(true);
    this.erroAlbum.set(null);
    try {
      const pagina = await this.petsService.album(id, cursor);
      if (id !== this.id()) return;
      this.fotos.update((fotos) => [...fotos, ...pagina.itens]);
      this.cursor.set(pagina.proximoCursor);
    } catch (erro) {
      this.erroAlbum.set(mensagemDeErro(erro, 'Não foi possível carregar mais fotos.'));
    } finally {
      this.carregandoMais.set(false);
    }
  }

  private async carregar(id: number): Promise<void> {
    this.estado.set('carregando');
    this.perfil.set(null);
    this.fotos.set([]);
    this.cursor.set(null);
    this.erroAlbum.set(null);
    try {
      const [perfil, pagina] = await Promise.all([
        this.petsService.perfil(id),
        this.petsService.album(id),
      ]);
      // Trocou de pet enquanto carregava: a resposta antiga não vale mais.
      if (id !== this.id()) return;
      this.perfil.set(perfil);
      this.fotos.set(pagina.itens);
      this.cursor.set(pagina.proximoCursor);
      this.estado.set('pronto');
    } catch (erro) {
      if (id !== this.id()) return;
      const status = (erro as { status?: number }).status;
      this.estado.set(status === 404 || status === 400 ? 'nao-encontrado' : 'erro');
    }
  }
}
