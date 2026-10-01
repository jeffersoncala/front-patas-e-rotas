import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { LatLng } from '../../../core/models';
import { PasseiosService } from '../../../core/passeios.service';
import { RotasService } from '../../../core/rotas.service';
import { Mapa } from '../../../shared/mapa/mapa';
import { NovoPasseio } from './novo-passeio';
import { provideApiFalsa } from '../../../testes/api-falsa';

const A: LatLng = [-22.9437, -43.1822];
const B: LatLng = [-22.9463, -43.1814];
const C: LatLng = [-22.9488, -43.1799];

describe('NovoPasseio', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NovoPasseio],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => {
    delete (navigator as { geolocation?: unknown }).geolocation;
    vi.useRealTimers();
  });

  function definirGeolocation(valor: unknown) {
    Object.defineProperty(navigator, 'geolocation', { value: valor, configurable: true });
  }

  async function criar(rota?: number) {
    const fixture = TestBed.createComponent(NovoPasseio);
    if (rota !== undefined) fixture.componentRef.setInput('rota', rota);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function mapa(fixture: Fixture): Mapa {
    return fixture.debugElement.query(By.directive(Mapa)).componentInstance;
  }

  async function clicarMapa(fixture: Fixture, ...pontos: LatLng[]) {
    for (const p of pontos) mapa(fixture).cliqueMapa.emit(p);
    await fixture.whenStable();
  }

  function botao(fixture: Fixture, texto: string): HTMLButtonElement {
    const el = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes(texto));
    if (!el) throw new Error(`Botão "${texto}" não encontrado`);
    return el;
  }

  function enviar(fixture: Fixture) {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
  }

  function digitar(fixture: Fixture, id: string, valor: string) {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  function distancia(fixture: Fixture): string {
    return fixture.nativeElement.querySelector('[data-testid="distancia"]').textContent.trim();
  }

  it('adiciona pontos ao clicar no mapa e atualiza a distância', async () => {
    const fixture = await criar();
    expect(distancia(fixture)).toContain('0,0');

    await clicarMapa(fixture, A, B, C);

    expect(mapa(fixture).trajetos()[0].pontos).toEqual([A, B, C]);
    expect(mapa(fixture).enquadrar()).toBe(false);
    expect(distancia(fixture)).not.toContain('0,0');
  });

  it('desfaz o último ponto e limpa o trajeto', async () => {
    const fixture = await criar();
    await clicarMapa(fixture, A, B, C);

    botao(fixture, 'Desfazer ponto').click();
    await fixture.whenStable();
    expect(mapa(fixture).trajetos()[0].pontos).toEqual([A, B]);

    botao(fixture, 'Limpar').click();
    await fixture.whenStable();
    expect(mapa(fixture).trajetos()).toEqual([]);
    expect(botao(fixture, 'Desfazer ponto').disabled).toBe(true);
  });

  it('não registra sem pontos nem duração', async () => {
    const fixture = await criar();
    const registrar = vi.spyOn(TestBed.inject(PasseiosService), 'registrar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    enviar(fixture);
    await fixture.whenStable();

    expect(registrar).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
    const erros = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.field__error'),
    ).map((e) => e.textContent);
    expect(erros.some((e) => e?.includes('pelo menos 2 pontos'))).toBe(true);
    expect(erros.some((e) => e?.includes('Informe quanto tempo'))).toBe(true);
  });

  it('pré-carrega a rota vinda da URL', async () => {
    const fixture = await criar(2);
    const rota = TestBed.inject(RotasService).porId(2)!;

    expect(mapa(fixture).trajetos()[0].pontos).toEqual(rota.pontos);
    expect(fixture.nativeElement.textContent).toContain(rota.nome);
    expect((fixture.nativeElement.querySelector('#duracao') as HTMLInputElement).value).toBe(
      String(rota.duracaoMin),
    );
    // Mostra a rota inteira até o tutor mexer no trajeto.
    expect(mapa(fixture).enquadrar()).toBe(true);
    await clicarMapa(fixture, A);
    expect(mapa(fixture).enquadrar()).toBe(false);
  });

  it('registra o passeio na rota pré-carregada e volta para a home', async () => {
    const fixture = await criar(2);
    const registrar = vi.spyOn(TestBed.inject(PasseiosService), 'registrar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const rota = TestBed.inject(RotasService).porId(2)!;

    digitar(fixture, 'texto', 'Muita sombra hoje');
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
    expect(registrar).toHaveBeenCalledWith({
      pontos: rota.pontos,
      duracaoMin: rota.duracaoMin,
      texto: 'Muita sombra hoje',
      rotaId: 2,
      rotaNome: rota.nome,
    });
  });

  it('salva uma nova rota favorita antes de registrar', async () => {
    const fixture = await criar();
    const rotas = TestBed.inject(RotasService);
    const criarRota = vi.spyOn(rotas, 'criar');
    const registrar = vi.spyOn(TestBed.inject(PasseiosService), 'registrar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await clicarMapa(fixture, A, B);
    digitar(fixture, 'duracao', '20');
    const check = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    check.click();
    await fixture.whenStable();

    // Sem nome e bairro, a rota não pode ser salva.
    enviar(fixture);
    await fixture.whenStable();
    expect(criarRota).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#nome-rota-erro')).not.toBeNull();

    digitar(fixture, 'nome-rota', 'Ida à padaria');
    digitar(fixture, 'bairro-rota', 'Catete');
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
    const nova = await criarRota.mock.results[0].value;
    expect(criarRota).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Ida à padaria', bairro: 'Catete', pontos: [A, B] }),
    );
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ duracaoMin: 20, rotaId: nova.id, rotaNome: 'Ida à padaria' }),
    );
  });

  describe('gravação com GPS', () => {
    function mockGeo() {
      let enviarPosicao!: PositionCallback;
      let enviarErro!: PositionErrorCallback;
      const geo = {
        watchPosition: vi.fn((ok: PositionCallback, erro: PositionErrorCallback) => {
          enviarPosicao = ok;
          enviarErro = erro;
          return 7;
        }),
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
      };
      definirGeolocation(geo);
      const posicao = ([latitude, longitude]: LatLng, accuracy = 10) =>
        enviarPosicao({ coords: { latitude, longitude, accuracy } } as GeolocationPosition);
      const erro = (code: number) =>
        enviarErro({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      return { geo, posicao, erro };
    }

    async function modoGps(fixture: Fixture) {
      botao(fixture, 'Gravar com GPS').click();
      await fixture.whenStable();
    }

    it('grava pontos precisos, ignora ruído e para o watch ao encerrar', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const { geo, posicao } = mockGeo();
      const fixture = await criar();
      await modoGps(fixture);

      botao(fixture, 'Iniciar').click();
      expect(geo.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ enableHighAccuracy: true }),
      );

      posicao(A);
      posicao(B, 120); // imprecisa demais
      posicao([A[0] + 0.00001, A[1]]); // ~1 m, parado
      posicao(C);
      vi.advanceTimersByTime(2 * 60_000);
      await fixture.whenStable();

      expect(mapa(fixture).trajetos()[0].pontos).toEqual([A, C]);
      expect(mapa(fixture).marcadores().some((m) => m.tipo === 'eu')).toBe(true);
      expect(mapa(fixture).centro()).toEqual(C);
      expect(fixture.nativeElement.querySelector('.cronometro').textContent).toContain('02:00');

      botao(fixture, 'Encerrar').click();
      await fixture.whenStable();
      expect(geo.clearWatch).toHaveBeenCalledWith(7);
      expect((fixture.nativeElement.querySelector('#duracao') as HTMLInputElement).value).toBe('2');
    });

    it('avisa quando a permissão é negada', async () => {
      const { erro } = mockGeo();
      const fixture = await criar();
      await modoGps(fixture);

      botao(fixture, 'Iniciar').click();
      erro(1);
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.alert[role="alert"]')?.textContent).toContain(
        'Sem permissão',
      );
    });

    it('avisa quando o navegador não tem geolocalização', async () => {
      definirGeolocation(undefined);
      const fixture = await criar();
      await modoGps(fixture);

      botao(fixture, 'Iniciar').click();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain(
        'não oferece localização',
      );
    });

    it('limpa o watch ao sair da tela', async () => {
      const { geo } = mockGeo();
      const fixture = await criar();
      await modoGps(fixture);
      botao(fixture, 'Iniciar').click();

      fixture.destroy();

      expect(geo.clearWatch).toHaveBeenCalledWith(7);
    });
  });
});
