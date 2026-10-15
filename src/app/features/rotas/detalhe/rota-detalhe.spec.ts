import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RotasService } from '../../../core/rotas.service';
import { RotaDetalhe } from './rota-detalhe';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { PASSEIOS_EXEMPLO } from '../../../testes/dados-exemplo';

describe('RotaDetalhe', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotaDetalhe],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  async function criar(id: number) {
    const fixture = TestBed.createComponent(RotaDetalhe);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
    return fixture;
  }

  it('mostra os dados da rota e os passeios feitos nela', async () => {
    const fixture = await criar(1);
    const el = fixture.nativeElement as HTMLElement;
    const passeios = PASSEIOS_EXEMPLO.filter((p) => p.rotaId === 1);

    expect(el.querySelector('h1')?.textContent).toContain('Volta da orla');
    expect(el.textContent).toContain('Botafogo');
    expect(el.textContent).toContain('Pão de Açúcar');
    expect(el.querySelector('[data-testid="total-passeios"]')?.textContent?.trim()).toBe(
      String(passeios.length),
    );
    expect(el.querySelector('.voltar')?.getAttribute('href')).toBe('/rotas');
  });

  it('mostra as fotos dos passeios que têm', async () => {
    const el = (await criar(1)).nativeElement as HTMLElement;
    const fotos = el.querySelectorAll<HTMLImageElement>('app-fotos-passeio img');
    expect(fotos).toHaveLength(1);
    expect(fotos[0].getAttribute('src')).toMatch(/\/fotos\/exemplo-orla$/);
    expect(fotos[0].alt).toBe('Foto 1 do passeio de Bolota');
  });

  it('leva para registrar um passeio nessa rota', async () => {
    const fixture = await criar(2);
    const link = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.btn--primary'),
    ).find((a) => a.textContent?.includes('Passear nessa rota'));

    expect(link?.getAttribute('href')).toBe('/passeios/novo?rota=2');
  });

  it('alterna a favorita', async () => {
    const fixture = await criar(4);
    const botao = (fixture.nativeElement as HTMLElement).querySelector(
      'button.chip',
    ) as HTMLButtonElement;
    expect(botao.getAttribute('aria-pressed')).toBe('false');

    botao.click();
    await fixture.whenStable();

    expect(TestBed.inject(RotasService).porId(4)?.favorita).toBe(true);
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });

  it('avisa quando a rota não existe', async () => {
    const fixture = await criar(999);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('Rota não encontrada');
    expect(el.querySelector('app-mapa')).toBeNull();
  });
});
