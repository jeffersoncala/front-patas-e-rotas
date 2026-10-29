import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CENTRO_PADRAO } from '../../../core/geo';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { ServicosLista } from './servicos-lista';

describe('ServicosLista', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicosLista],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  /** O jsdom não tem geolocalização; cada teste define a sua. */
  function simularGeolocalizacao(geolocation: Partial<Geolocation> | undefined) {
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  }

  afterEach(() => {
    delete (navigator as { geolocation?: Geolocation }).geolocation;
  });

  async function criar() {
    const fixture = TestBed.createComponent(ServicosLista);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  const nomes = (fixture: Fixture) =>
    ([...fixture.nativeElement.querySelectorAll('.servico__nome')] as HTMLElement[]).map((el) =>
      el.textContent?.trim(),
    );

  function botao(fixture: Fixture, texto: string) {
    return ([...fixture.nativeElement.querySelectorAll('.tabs__item')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === texto,
    )!;
  }

  async function esperarNomes(fixture: Fixture, esperado: string[]) {
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(nomes(fixture)).toEqual(esperado);
    });
  }

  it('lista os serviços até 10 km, do mais perto ao mais longe', async () => {
    simularGeolocalizacao({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({
          coords: { latitude: CENTRO_PADRAO[0], longitude: CENTRO_PADRAO[1] },
        } as GeolocationPosition),
    });
    const fixture = await criar();

    await esperarNomes(fixture, ['Ana Passeios', 'Jeff Passeios', 'Casa do Rafael']);
    const el = fixture.nativeElement as HTMLElement;
    expect(botao(fixture, '10 km').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.servico__preco')?.textContent).toMatch(/a partir de\s+R\$\s25,00/);
    expect(el.querySelector('app-estrelas')?.textContent).toContain('1 avaliação');
    expect(el.querySelector('.alert')).toBeNull();
  });

  it('filtra pelo tipo e aumenta o raio', async () => {
    simularGeolocalizacao(undefined);
    const fixture = await criar();
    await esperarNomes(fixture, ['Ana Passeios', 'Jeff Passeios', 'Casa do Rafael']);
    expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain('centro padrão');

    botao(fixture, 'Passeadores').click();
    await esperarNomes(fixture, ['Ana Passeios', 'Jeff Passeios']);

    botao(fixture, 'Banho e tosa').click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain(
        'Aumente o raio',
      );
    });

    botao(fixture, '25 km').click();
    await esperarNomes(fixture, ['Banho da Júlia']);
  });
});
