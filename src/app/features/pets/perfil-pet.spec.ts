import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PerfilPet } from './perfil-pet';
import { entrarComoExemplo, provideApiFalsa } from '../../testes/api-falsa';

describe('PerfilPet', () => {
  beforeEach(async () => {
    entrarComoExemplo();
    await TestBed.configureTestingModule({
      imports: [PerfilPet],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  async function criar(id: number) {
    const fixture = TestBed.createComponent(PerfilPet);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o pet de outro tutor, com os números e o álbum vazio', async () => {
    const el = await criar(11);

    expect(el.querySelector('h1')?.textContent).toContain('Mel');
    expect(el.querySelector('.tutor')?.textContent).toContain('Ana');
    expect(el.querySelector('[data-testid="total-passeios"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.album')).toBeNull();
    expect(el.textContent).toContain('Ainda não há fotos de Mel');
  });

  it('mostra o álbum com as fotos dos passeios do pet', async () => {
    const el = await criar(1);

    expect(el.querySelector('h1')?.textContent).toContain('Bolota');
    expect(el.querySelector('.tutor')?.textContent).toContain('Seu pet');
    expect(el.querySelector('[data-testid="total-fotos"]')?.textContent?.trim()).toBe('1');
    const fotos = el.querySelectorAll<HTMLImageElement>('.album img');
    expect(fotos).toHaveLength(1);
    expect(fotos[0].getAttribute('src')).toMatch(/\/fotos\/exemplo-orla$/);
    expect(fotos[0].alt).toContain('Foto de Bolota');
  });

  it('avisa quando o pet não existe', async () => {
    const el = await criar(999);

    expect(el.querySelector('h1')?.textContent).toContain('Pet não encontrado');
    expect(el.querySelector('.album')).toBeNull();
  });
});
