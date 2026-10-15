import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { REDUZIR_IMAGEM } from '../../core/imagem';
import { Perfil, Pet } from '../../core/models';
import { MeuPerfil } from './meu-perfil';
import { entrarComoExemplo, provideApiFalsa } from '../../testes/api-falsa';

const BOLOTA: Pet = {
  id: 1,
  nome: 'Bolota',
  especie: 'cachorro',
  raca: 'Vira-lata',
  idadeAnos: 4,
  porte: 'medio',
  bio: 'Adora petiscos.',
  foto: null,
};

const PERFIL: Perfil = {
  tutor: 'Jeff',
  email: 'tutor@exemplo.com',
  foto: null,
  metaSemanalKm: 15,
  pets: [BOLOTA],
};

const IMAGEM = 'data:image/jpeg;base64,/9j/AA==';

describe('MeuPerfil', () => {
  let reduzir: ReturnType<typeof vi.fn<(arquivo: Blob) => Promise<string>>>;

  async function configurar(perfil: Perfil = PERFIL) {
    entrarComoExemplo(perfil);
    reduzir = vi.fn(async () => IMAGEM);
    await TestBed.configureTestingModule({
      imports: [MeuPerfil],
      providers: [
        provideRouter([]),
        provideApiFalsa(perfil),
        { provide: REDUZIR_IMAGEM, useValue: reduzir },
      ],
    }).compileComponents();
  }

  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(MeuPerfil);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof criar>;

  function botao(el: HTMLElement, texto: string) {
    const achado = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.replace(/\s+/g, ' ').includes(texto),
    );
    if (!achado) throw new Error(`Botão "${texto}" não encontrado`);
    return achado;
  }

  function digitar(el: HTMLElement, id: string, valor: string) {
    const campo = el.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  async function enviarForm(fixture: Fixture) {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')!
      .dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  /** Simula o tutor escolhendo um arquivo no seletor. */
  async function escolherArquivo(fixture: Fixture) {
    const seletor = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;
    const arquivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(seletor, 'files', { value: [arquivo], configurable: true });
    seletor.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(reduzir).toHaveBeenCalledWith(arquivo));
    await fixture.whenStable();
  }

  describe('com um pet', () => {
    beforeEach(() => configurar());

    it('mostra o tutor, o pet e o histórico de passeios', () => {
      const el = criar().nativeElement as HTMLElement;
      expect(el.querySelector('h1')?.textContent).toContain('Jeff');
      expect(el.querySelector('.pet__nome')?.textContent).toContain('Bolota');
      expect(el.querySelector('.pet__descricao')?.textContent).toContain('Cachorro · Vira-lata');
      expect(el.querySelectorAll('.passeio').length).toBe(2);
    });

    it('mostra as fotos dos meus passeios e leva para editar cada um', () => {
      const el = criar().nativeElement as HTMLElement;
      const fotos = el.querySelectorAll<HTMLImageElement>('.passeio__extra img');
      expect(fotos).toHaveLength(1);
      expect(fotos[0].getAttribute('src')).toMatch(/\/fotos\/exemplo-orla$/);
      const links = [...el.querySelectorAll('.passeio__extra a.card__link')].map((a) =>
        a.getAttribute('href'),
      );
      expect(links.sort()).toEqual(['/passeios/4/editar', '/passeios/5/editar']);
    });

    it('remove o único pet e mostra o perfil sem pets', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;

      botao(el, 'Remover Bolota').click();
      await fixture.whenStable();
      botao(el.querySelector('.confirmar')!, 'Remover').click();
      await fixture.whenStable();

      expect(TestBed.inject(AuthService).perfil()?.pets).toEqual([]);
      expect(el.querySelector('.pets .vazio')?.textContent).toContain('Nenhum pet cadastrado');
    });

    it('não salva o tutor com nome vazio e salva as alterações válidas', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const atualizar = vi.spyOn(TestBed.inject(AuthService), 'atualizarPerfil');

      botao(el, 'Editar perfil').click();
      await fixture.whenStable();

      digitar(el, 'tutor', ' ');
      await enviarForm(fixture);
      expect(atualizar).not.toHaveBeenCalled();
      expect(el.querySelector('#tutor-erro')).not.toBeNull();

      digitar(el, 'tutor', ' Jefferson ');
      digitar(el, 'meta', '25');
      await enviarForm(fixture);
      expect(atualizar).toHaveBeenCalledWith({ tutor: 'Jefferson', metaSemanalKm: 25 });
      expect(el.querySelector('h1')?.textContent).toContain('Jefferson');
      expect(el.textContent).toContain('Meta semanal: 25 km');
    });

    it('adiciona um pet novo', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;

      botao(el, 'Adicionar pet').click();
      await fixture.whenStable();

      await enviarForm(fixture);
      expect(el.querySelector('#pet-nome-erro')).not.toBeNull();

      digitar(el, 'pet-nome', 'Mingau');
      const especie = el.querySelector<HTMLSelectElement>('#pet-especie')!;
      especie.value = 'gato';
      especie.dispatchEvent(new Event('change'));
      await enviarForm(fixture);

      const nomes = [...el.querySelectorAll('.pet__nome')].map((n) => n.textContent?.trim());
      expect(nomes).toEqual(['Bolota', 'Mingau']);
      expect(TestBed.inject(AuthService).perfil()?.pets[1]).toMatchObject({
        nome: 'Mingau',
        especie: 'gato',
      });
      expect(el.querySelector('h2#pets-titulo')?.textContent).toContain('Meus pets');
    });

    it('edita o pet', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const atualizarPet = vi.spyOn(TestBed.inject(AuthService), 'atualizarPet');

      botao(el, 'Editar Bolota').click();
      await fixture.whenStable();
      expect(el.querySelector<HTMLInputElement>('#pet-nome')!.value).toBe('Bolota');

      digitar(el, 'pet-nome', 'Bolinha');
      await enviarForm(fixture);

      expect(atualizarPet).toHaveBeenCalledWith(1, expect.objectContaining({ nome: 'Bolinha' }));
      expect(el.querySelector('.pet__nome')?.textContent).toContain('Bolinha');
    });

    it('envia a foto do tutor já reduzida e permite removê-la', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const auth = TestBed.inject(AuthService);
      const trocar = vi.spyOn(auth, 'trocarFoto');

      botao(el, 'Adicionar foto de Jeff').click();
      await escolherArquivo(fixture);

      expect(trocar).toHaveBeenCalledWith(IMAGEM);
      expect(auth.perfil()?.foto).toMatch(/^\/fotos\//);
      expect(el.querySelector('.perfil img')?.getAttribute('src')).toContain('/fotos/');

      botao(el, 'Remover foto de Jeff').click();
      await fixture.whenStable();
      expect(auth.perfil()?.foto).toBeNull();
      expect(el.querySelector('.perfil img')).toBeNull();
    });

    it('envia a foto do pet escolhido', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const trocarFotoPet = vi.spyOn(TestBed.inject(AuthService), 'trocarFotoPet');

      botao(el, 'Adicionar foto de Bolota').click();
      await escolherArquivo(fixture);

      expect(trocarFotoPet).toHaveBeenCalledWith(1, IMAGEM);
      expect(el.querySelector('.pet img')?.getAttribute('src')).toContain('/fotos/pet-1');
    });

    it('mostra o erro quando o arquivo não é uma imagem', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const trocar = vi.spyOn(TestBed.inject(AuthService), 'trocarFoto');
      reduzir.mockRejectedValueOnce(new Error('Escolha um arquivo de imagem.'));

      botao(el, 'Adicionar foto de Jeff').click();
      await escolherArquivo(fixture);

      expect(trocar).not.toHaveBeenCalled();
      expect(el.querySelector('.alert')?.textContent).toContain('Escolha um arquivo de imagem.');
    });

    it('sai da conta e volta para o login', async () => {
      const fixture = criar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      botao(fixture.nativeElement, 'Sair').click();
      await fixture.whenStable();

      expect(TestBed.inject(AuthService).autenticado()).toBe(false);
      expect(navegar).toHaveBeenCalledWith('/login');
    });
  });

  describe('com dois pets', () => {
    beforeEach(() =>
      configurar({
        ...PERFIL,
        pets: [BOLOTA, { ...BOLOTA, id: 2, nome: 'Mingau', especie: 'gato', foto: '/fotos/abc' }],
      }),
    );

    it('remove um pet só depois de confirmar', async () => {
      const fixture = criar();
      const el = fixture.nativeElement as HTMLElement;
      const removerPet = vi.spyOn(TestBed.inject(AuthService), 'removerPet');

      botao(el, 'Remover Mingau').click();
      await fixture.whenStable();
      expect(el.querySelector('.confirmar')?.textContent).toContain('Remover Mingau do perfil?');

      botao(el, 'Cancelar').click();
      await fixture.whenStable();
      expect(el.querySelector('.confirmar')).toBeNull();
      expect(removerPet).not.toHaveBeenCalled();

      botao(el, 'Remover Mingau').click();
      await fixture.whenStable();
      botao(el.querySelector('.confirmar')!, 'Remover').click();
      await fixture.whenStable();

      expect(removerPet).toHaveBeenCalledWith(2);
      const nomes = [...el.querySelectorAll('.pet__nome')].map((n) => n.textContent?.trim());
      expect(nomes).toEqual(['Bolota']);
    });

    it('mostra a foto que o pet já tem', () => {
      const el = criar().nativeElement as HTMLElement;
      const fotos = [...el.querySelectorAll('.pet')].map((p) => p.querySelector('img'));
      expect(fotos[0]).toBeNull();
      expect(fotos[1]?.getAttribute('src')).toMatch(/\/fotos\/abc$/);
    });
  });
});
