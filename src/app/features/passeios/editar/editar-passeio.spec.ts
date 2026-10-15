import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { REDUZIR_IMAGEM } from '../../../core/imagem';
import { PasseiosService } from '../../../core/passeios.service';
import { entrarComoExemplo, provideApiFalsa } from '../../../testes/api-falsa';
import { EditarPasseio } from './editar-passeio';

describe('EditarPasseio', () => {
  beforeEach(async () => {
    entrarComoExemplo();
    await TestBed.configureTestingModule({
      imports: [EditarPasseio],
      providers: [
        provideRouter([]),
        provideApiFalsa(),
        // O jsdom não tem canvas: a "redução" devolve um data URL com o nome do arquivo.
        {
          provide: REDUZIR_IMAGEM,
          useValue: async (arquivo: Blob) => `data:image/jpeg;base64,${(arquivo as File).name}`,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  async function criar(id: number) {
    const fixture = TestBed.createComponent(EditarPasseio);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function previas(fixture: Fixture): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLImageElement>('.foto img'),
    ).map((img) => img.getAttribute('src')!);
  }

  it('carrega o passeio com as fotos que ele já tem', async () => {
    const fixture = await criar(5);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector<HTMLInputElement>('#duracao')?.value).toBe('50');
    expect(el.querySelector<HTMLTextAreaElement>('#texto')?.value).toContain('Dia de sol');
    expect(previas(fixture)).toEqual([expect.stringMatching(/\/fotos\/exemplo-orla$/)]);
  });

  it('salva texto, duração e fotos (mantidas pelo caminho, novas em data URL)', async () => {
    const fixture = await criar(5);
    const el = fixture.nativeElement as HTMLElement;
    const alterar = vi.spyOn(TestBed.inject(PasseiosService), 'alterar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const texto = el.querySelector<HTMLTextAreaElement>('#texto')!;
    texto.value = ' Choveu no fim ';
    texto.dispatchEvent(new Event('input'));

    const seletor = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const arquivo = new File(['x'], 'nova.jpg', { type: 'image/jpeg' });
    Object.defineProperty(seletor, 'files', { value: [arquivo], configurable: true });
    seletor.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(previas(fixture)).toHaveLength(2));

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/perfil'));
    expect(alterar).toHaveBeenCalledWith(5, {
      duracaoMin: 50,
      texto: 'Choveu no fim',
      fotos: ['/fotos/exemplo-orla', 'data:image/jpeg;base64,nova.jpg'],
    });
    const atualizado = await alterar.mock.results[0].value;
    expect(atualizado.fotos).toEqual(['/fotos/exemplo-orla', expect.stringMatching(/passeio-/)]);
  });

  it('não salva com duração inválida', async () => {
    const fixture = await criar(5);
    const el = fixture.nativeElement as HTMLElement;
    const alterar = vi.spyOn(TestBed.inject(PasseiosService), 'alterar');

    const duracao = el.querySelector<HTMLInputElement>('#duracao')!;
    duracao.value = '';
    duracao.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(alterar).not.toHaveBeenCalled();
    expect(el.querySelector('#duracao-erro')?.textContent).toContain('Informe quanto tempo durou');
  });

  it('não deixa editar passeio de outro tutor', async () => {
    const el = (await criar(1)).nativeElement as HTMLElement;
    expect(el.querySelector('.alert')?.textContent).toContain('Só quem registrou');
    expect(el.querySelector('form')).toBeNull();
  });

  it('avisa quando o passeio não existe', async () => {
    const el = (await criar(999)).nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Passeio não encontrado');
  });
});
