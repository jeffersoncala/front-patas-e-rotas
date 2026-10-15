import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { PERFIL_EXEMPLO, entrarComoExemplo, provideApiFalsa } from '../../testes/api-falsa';

describe('Home', () => {
  beforeEach(async () => {
    entrarComoExemplo();
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture;
  }

  it('saúda o pet no título', () => {
    const compiled = criar().nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bolota');
  });

  it('sem pets, convida a cadastrar o primeiro no perfil', () => {
    entrarComoExemplo({ ...PERFIL_EXEMPLO, pets: [] });
    const compiled = criar().nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bora passear hoje?');
    expect(compiled.querySelector('.welcome a[href="/perfil"]')?.textContent).toContain(
      'cadastrando seu pet',
    );
  });

  it('com vários pets, cita todos no título', () => {
    entrarComoExemplo({
      ...PERFIL_EXEMPLO,
      pets: [...PERFIL_EXEMPLO.pets, { ...PERFIL_EXEMPLO.pets[0], id: 2, nome: 'Mingau' }],
    });
    const compiled = criar().nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bolota e Mingau');
  });

  it('mostra os pets de cada passeio no feed', () => {
    const el = criar().nativeElement as HTMLElement;
    const primeiro = el.querySelector('.post')!;
    expect(primeiro.querySelector('.post__meta')?.textContent).toContain('Mel com Ana');
    expect(primeiro.querySelector('.post__avatar')?.textContent?.trim()).toBe('M');
  });

  it('confirma presença em um encontro e atualiza o resumo', async () => {
    const fixture = criar();
    const el = fixture.nativeElement as HTMLElement;
    const valorConfirmados = () => el.querySelectorAll('.stat__value')[2].textContent?.trim();
    expect(valorConfirmados()).toBe('1');

    const chip = el.querySelectorAll<HTMLButtonElement>('.chip')[1];
    chip.click();
    await fixture.whenStable();

    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(valorConfirmados()).toBe('2');
  });

  it('alterna a curtida de um passeio', async () => {
    const fixture = criar();
    const like = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.like')!;
    expect(like.textContent).toContain('18');

    like.click();
    await fixture.whenStable();

    expect(like.getAttribute('aria-pressed')).toBe('true');
    expect(like.textContent).toContain('19');
  });
});
