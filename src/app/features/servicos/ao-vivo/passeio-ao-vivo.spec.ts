import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { LatLng } from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Mapa } from '../../../shared/mapa/mapa';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { CONSULTA_MS, ENVIO_MS, PasseioAoVivo } from './passeio-ao-vivo';

describe('PasseioAoVivo', () => {
  beforeEach(async () => {
    // Só os intervalos ficam no relógio falso: envio do GPS, consulta do tutor e cronômetro.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await TestBed.configureTestingModule({
      imports: [PasseioAoVivo],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (navigator as { geolocation?: Geolocation }).geolocation;
  });

  async function criar(id: number) {
    const fixture = TestBed.createComponent(PasseioAoVivo);
    fixture.componentRef.setInput('id', id);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('h1, .vazio:not(:empty)')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Carregando');
    });
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  const texto = (fixture: Fixture) => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const mapa = (fixture: Fixture) =>
    fixture.debugElement.query(By.directive(Mapa)).componentInstance as Mapa;
  const pontosNoMapa = (fixture: Fixture) => mapa(fixture).trajetos()[0]?.pontos.length ?? 0;

  function botao(fixture: Fixture, inicio: string) {
    return ([...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim().startsWith(inicio),
    );
  }

  /** GPS falso: devolve a função que entrega uma leitura ao `watchPosition`. */
  function simularGps() {
    let entregar: PositionCallback = () => undefined;
    const geolocation = {
      watchPosition: vi.fn((ok: PositionCallback) => {
        entregar = ok;
        return 1;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
    return {
      geolocation,
      ler: ([latitude, longitude]: LatLng, accuracy = 10) =>
        entregar({ coords: { latitude, longitude, accuracy } } as GeolocationPosition),
    };
  }

  it('o passeador inicia ao pegar o pet, envia o trajeto e encerra ao devolver', async () => {
    const gps = simularGps();
    const servico = TestBed.inject(ServicosService);
    const mudarStatus = vi.spyOn(servico, 'mudarStatus');
    const enviarPosicoes = vi.spyOn(servico, 'enviarPosicoes');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await criar(5);

    expect(gps.geolocation.watchPosition).not.toHaveBeenCalled();
    botao(fixture, 'Peguei Mel')!.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(texto(fixture)).toContain('Ao vivo');
    });
    expect(mudarStatus).toHaveBeenCalledWith(5, 'em_andamento');
    expect(texto(fixture)).toContain('Deixe esta tela aberta');

    gps.ler([-22.94, -43.18]);
    gps.ler([-22.94, -43.18], 200); // imprecisa: descartada
    gps.ler([-22.94001, -43.18]); // ~1 m: parado, descartada
    gps.ler([-22.941, -43.18]);
    await fixture.whenStable();
    expect(pontosNoMapa(fixture)).toBe(2);
    expect(enviarPosicoes).not.toHaveBeenCalled();

    vi.advanceTimersByTime(ENVIO_MS);
    await vi.waitFor(() =>
      expect(enviarPosicoes).toHaveBeenCalledWith(5, [
        [-22.94, -43.18],
        [-22.941, -43.18],
      ]),
    );

    // O que chegar depois do último envio vai junto ao encerrar.
    gps.ler([-22.942, -43.18]);
    botao(fixture, 'Devolvi Mel')!.click();
    await vi.waitFor(() =>
      expect(navegar).toHaveBeenCalledWith(['/servicos/pedidos'], {
        queryParams: { papel: 'prestador' },
      }),
    );
    expect(enviarPosicoes).toHaveBeenLastCalledWith(5, [[-22.942, -43.18]]);
    expect(mudarStatus).toHaveBeenLastCalledWith(5, 'concluida');
    expect(gps.geolocation.clearWatch).toHaveBeenCalledWith(1);

    const { totalPontos } = await servico.acompanhamento(5);
    expect(totalPontos).toBe(3);
  });

  it('o tutor acompanha só os pontos novos e vê quando o passeio termina', async () => {
    const servico = TestBed.inject(ServicosService);
    const fixture = await criar(4);
    const acompanhamento = vi.spyOn(servico, 'acompanhamento');

    expect(texto(fixture)).toContain('Ao vivo');
    expect(texto(fixture)).toContain('Passeador: Ana Passeios');
    expect(texto(fixture)).toMatch(/há \d+ s/);
    expect(botao(fixture, 'Devolvi')).toBeUndefined();
    expect(pontosNoMapa(fixture)).toBe(6);

    // Do outro lado, a passeadora anda mais um pouco.
    await servico.enviarPosicoes(4, [[-22.95, -43.18]]);
    vi.advanceTimersByTime(CONSULTA_MS);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(pontosNoMapa(fixture)).toBe(7);
    });
    expect(acompanhamento).toHaveBeenCalledWith(4, 6);

    await servico.mudarStatus(4, 'concluida');
    vi.advanceTimersByTime(CONSULTA_MS);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(texto(fixture)).toContain('Passeio concluído');
    });
    expect(texto(fixture)).not.toContain('Ao vivo');
    expect(fixture.nativeElement.querySelector('a.btn')?.textContent).toContain('Avaliar');
  });

  it('avisa quando o sinal do passeador some', async () => {
    const fixture = await criar(4);
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();

    // Dois minutos sem ponto novo.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60_000);
    vi.advanceTimersByTime(1000);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
        'Sem sinal do passeador',
      );
    });
  });

  it('não abre pedidos que não são passeio', async () => {
    const fixture = await criar(2);
    expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain('não existe');
  });
});
