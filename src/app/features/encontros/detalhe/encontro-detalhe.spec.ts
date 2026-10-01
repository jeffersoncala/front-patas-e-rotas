import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EncontroDetalhe } from './encontro-detalhe';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { ENCONTROS_EXEMPLO } from '../../../testes/dados-exemplo';

describe('EncontroDetalhe', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncontroDetalhe],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  async function criar(id: number) {
    const fixture = TestBed.createComponent(EncontroDetalhe);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    return fixture;
  }

  function botaoPresenca(el: HTMLElement) {
    return el.querySelector('.detalhe__acoes button') as HTMLButtonElement;
  }

  it('mostra os dados do encontro e o link "Como chegar"', async () => {
    const encontro = ENCONTROS_EXEMPLO.find((e) => e.id === 1)!;
    const el = (await criar(1)).nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain(encontro.titulo);
    expect(el.textContent).toContain(encontro.local);
    expect(el.textContent).toContain(encontro.organizador);
    expect(el.querySelector('.detalhe__confirmados')?.textContent).toContain(
      String(encontro.confirmados),
    );
    const link = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Como chegar'))!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.href).toContain('openstreetmap.org/directions');
    expect(el.querySelector('app-mapa')).not.toBeNull();
  });

  it('alterna a presença pelo botão principal', async () => {
    const alvo = ENCONTROS_EXEMPLO.find((e) => !e.vou)!;
    const fixture = await criar(alvo.id);
    const el = fixture.nativeElement as HTMLElement;

    expect(botaoPresenca(el).textContent).toContain('Vou!');
    expect(botaoPresenca(el).classList).toContain('btn--primary');

    botaoPresenca(el).click();
    await fixture.whenStable();

    expect(botaoPresenca(el).textContent).toContain('Cancelar presença');
    expect(botaoPresenca(el).classList).toContain('btn--secondary');
    expect(botaoPresenca(el).getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.detalhe__confirmados')?.textContent).toContain(
      String(alvo.confirmados + 1),
    );
  });

  it('mostra "Encontro não encontrado" para um id inexistente', async () => {
    const el = (await criar(9999)).nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('Encontro não encontrado');
    expect(el.querySelector('app-mapa')).toBeNull();
    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/encontros');
  });
});
