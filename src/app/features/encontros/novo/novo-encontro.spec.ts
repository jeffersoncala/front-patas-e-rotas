import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { EncontrosService } from '../../../core/encontros.service';
import { LatLng } from '../../../core/models';
import { Mapa } from '../../../shared/mapa/mapa';
import { NovoEncontro } from './novo-encontro';
import { provideApiFalsa } from '../../../testes/api-falsa';

describe('NovoEncontro', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NovoEncontro],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  /** O jsdom não tem geolocalização; definimos uma falsa só no teste que precisa. */
  function simularGeolocalizacao(geolocation: Partial<Geolocation> | undefined) {
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  }

  afterEach(() => {
    delete (navigator as { geolocation?: Geolocation }).geolocation;
  });

  async function criar() {
    const fixture = TestBed.createComponent(NovoEncontro);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function digitar(fixture: Fixture, id: string, valor: string) {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = valor;
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('blur'));
  }

  function enviar(fixture: Fixture) {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
  }

  function mapa(fixture: Fixture) {
    return fixture.debugElement.query(By.directive(Mapa));
  }

  function clicarNoMapa(fixture: Fixture, posicao: LatLng) {
    mapa(fixture).triggerEventHandler('cliqueMapa', posicao);
  }

  function botaoLocalizacao(fixture: Fixture) {
    return fixture.nativeElement.querySelector('button.btn--secondary') as HTMLButtonElement;
  }

  /** Valor no formato do datetime-local, deslocado a partir de agora. */
  function dataLocal(deslocamentoMs: number) {
    const d = new Date(Date.now() + deslocamentoMs);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  it('marca os erros e não cria quando o formulário está vazio', async () => {
    const fixture = await criar();
    const criarEncontro = vi.spyOn(TestBed.inject(EncontrosService), 'criar');

    enviar(fixture);
    await fixture.whenStable();

    expect(criarEncontro).not.toHaveBeenCalled();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#titulo-erro')).not.toBeNull();
    expect(el.querySelector('#local-erro')).not.toBeNull();
    expect(el.querySelector('#data-erro')).not.toBeNull();
    expect(el.querySelector('#posicao-erro')?.textContent).toContain('Toque no mapa');
  });

  it('recusa data no passado', async () => {
    const fixture = await criar();

    digitar(fixture, 'data', dataLocal(-60 * 60_000));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#data-erro')?.textContent).toContain('no futuro');
  });

  it('marca o ponto ao clicar no mapa e limpa o erro de posição', async () => {
    const fixture = await criar();
    enviar(fixture);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#posicao-erro')).not.toBeNull();

    clicarNoMapa(fixture, [-22.93, -43.18]);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#posicao-erro')).toBeNull();
    const instancia = mapa(fixture).componentInstance as Mapa;
    expect(instancia.marcadores()).toEqual([
      expect.objectContaining({ posicao: [-22.93, -43.18], tipo: 'destaque' }),
    ]);
    expect(instancia.centro()).toEqual([-22.93, -43.18]);
  });

  it('avisa quando a localização não está disponível', async () => {
    simularGeolocalizacao(undefined);
    const fixture = await criar();

    botaoLocalizacao(fixture).click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain('localização');
  });

  it('avisa quando a permissão de localização é negada', async () => {
    simularGeolocalizacao({
        getCurrentPosition: (_ok: PositionCallback, erro: PositionErrorCallback) =>
          erro({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    });
    const fixture = await criar();

    botaoLocalizacao(fixture).click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain('Sem permissão');
  });

  it('usa a localização do GPS como ponto do encontro', async () => {
    simularGeolocalizacao({
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: -22.9, longitude: -43.2 } } as GeolocationPosition),
    });
    const fixture = await criar();

    botaoLocalizacao(fixture).click();
    await fixture.whenStable();

    const instancia = mapa(fixture).componentInstance as Mapa;
    expect(instancia.centro()).toEqual([-22.9, -43.2]);
    expect(instancia.marcadores().map((m) => m.tipo)).toEqual(['eu', 'destaque']);
  });

  it('cria o encontro e navega para o detalhe', async () => {
    const fixture = await criar();
    const service = TestBed.inject(EncontrosService);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const data = dataLocal(2 * 24 * 60 * 60_000);

    digitar(fixture, 'titulo', 'Piquenique pet');
    digitar(fixture, 'descricao', 'Traga a canga');
    digitar(fixture, 'local', 'Aterro do Flamengo');
    digitar(fixture, 'data', data);
    clicarNoMapa(fixture, [-22.93, -43.18]);
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalled());
    const novo = service.encontros().find((e) => e.titulo === 'Piquenique pet')!;
    expect(novo).toMatchObject({
      descricao: 'Traga a canga',
      local: 'Aterro do Flamengo',
      posicao: [-22.93, -43.18],
      data: new Date(data).toISOString(),
      vou: true,
    });
    expect(navegar).toHaveBeenCalledWith(['/encontros', novo.id]);
  });
});
