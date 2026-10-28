import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CENTRO_PADRAO } from '../../../core/geo';
import { LatLng } from '../../../core/models';
import { Mapa } from '../../../shared/mapa/mapa';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { DESAPARECIDOS_EXEMPLO } from '../../../testes/dados-exemplo';
import { DesaparecidosLista } from './desaparecidos-lista';

describe('DesaparecidosLista', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesaparecidosLista],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  /** O jsdom não tem geolocalização; cada teste define a sua. */
  function simularGeolocalizacao(geolocation: Partial<Geolocation> | undefined) {
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  }

  const gpsEm = (posicao: LatLng) =>
    simularGeolocalizacao({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: posicao[0], longitude: posicao[1] } } as GeolocationPosition),
    });

  afterEach(() => {
    delete (navigator as { geolocation?: Geolocation }).geolocation;
    vi.restoreAllMocks();
  });

  async function criar() {
    const fixture = TestBed.createComponent(DesaparecidosLista);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function nomes(fixture: Fixture) {
    return (
      [...fixture.nativeElement.querySelectorAll('.list > li .item__title')] as HTMLElement[]
    ).map((el) => el.textContent?.trim());
  }

  function raio(fixture: Fixture, km: number) {
    return ([...fixture.nativeElement.querySelectorAll('.tabs__item')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === `${km} km`,
    )!;
  }

  function mapa(fixture: Fixture) {
    return fixture.debugElement.query(By.directive(Mapa)).componentInstance as Mapa;
  }

  async function esperarNomes(fixture: Fixture, esperado: string[]) {
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(nomes(fixture)).toEqual(esperado);
    });
  }

  it('busca em volta do tutor no raio padrão de 5 km, do mais perto ao mais longe', async () => {
    gpsEm(CENTRO_PADRAO);
    const fixture = await criar();

    await esperarNomes(fixture, ['Pipoca', 'Bolota']);
    expect(raio(fixture, 5).getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Buscando em volta de você');
    expect(mapa(fixture).circulo()).toEqual({ centro: CENTRO_PADRAO, raioKm: 5 });
    expect(
      mapa(fixture)
        .marcadores()
        .map((m) => m.id),
    ).toEqual(['centro', 1, 2]);
    expect(fixture.nativeElement.querySelector('.desaparecido__distancia')?.textContent).toMatch(
      /a \d+ m/,
    );
  });

  it('troca o raio da busca', async () => {
    gpsEm(CENTRO_PADRAO);
    const fixture = await criar();
    await esperarNomes(fixture, ['Pipoca', 'Bolota']);

    raio(fixture, 25).click();
    await esperarNomes(fixture, ['Pipoca', 'Bolota', 'Frajola']);
    expect(raio(fixture, 25).getAttribute('aria-pressed')).toBe('true');
    expect(mapa(fixture).circulo()?.raioKm).toBe(25);

    raio(fixture, 1).click();
    await esperarNomes(fixture, ['Pipoca']);
  });

  it('mostra o estado vazio sugerindo aumentar o raio', async () => {
    gpsEm([0, 0]);
    const fixture = await criar();

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain(
        'Aumente o raio',
      );
    });
  });

  it('sem localização, avisa e busca em volta do centro padrão', async () => {
    simularGeolocalizacao(undefined);
    const fixture = await criar();

    await esperarNomes(fixture, ['Pipoca', 'Bolota']);
    expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain('localização');
    expect(fixture.nativeElement.textContent).toContain('centro padrão');
  });

  it('busca em volta do ponto tocado no mapa', async () => {
    gpsEm(CENTRO_PADRAO);
    const fixture = await criar();
    await esperarNomes(fixture, ['Pipoca', 'Bolota']);

    const frajola = DESAPARECIDOS_EXEMPLO.find((d) => d.nome === 'Frajola')!;
    fixture.debugElement
      .query(By.directive(Mapa))
      .triggerEventHandler('cliqueMapa', frajola.posicao);

    await esperarNomes(fixture, ['Frajola']);
    expect(fixture.nativeElement.textContent).toContain('ponto escolhido no mapa');
  });

  it('oferece ligar e chamar no WhatsApp quando o contato é um telefone', async () => {
    gpsEm(CENTRO_PADRAO);
    const fixture = await criar();
    await esperarNomes(fixture, ['Pipoca', 'Bolota']);

    const [pipoca, bolota] = [...fixture.nativeElement.querySelectorAll('.desaparecido__contato')];
    const links = [...pipoca.querySelectorAll('a')].map((a) =>
      (a as HTMLAnchorElement).getAttribute('href'),
    );
    expect(links).toEqual(['tel:+5521988881234', 'https://wa.me/5521988881234']);
    expect(bolota.querySelector('a')).toBeNull();
  });

  it('quem cadastrou marca como encontrado e o pet sai da lista', async () => {
    gpsEm(CENTRO_PADRAO);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await criar();
    await esperarNomes(fixture, ['Pipoca', 'Bolota']);

    const botoes = [
      ...fixture.nativeElement.querySelectorAll('.list .chip'),
    ] as HTMLButtonElement[];
    expect(botoes.length).toBe(1);
    expect(botoes[0].textContent).toContain('Bolota');

    botoes[0].click();
    await esperarNomes(fixture, ['Pipoca']);
    expect(confirmar).toHaveBeenCalled();
  });
});
