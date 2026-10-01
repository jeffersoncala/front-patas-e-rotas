import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { EncontrosService } from '../../../core/encontros.service';
import { Mapa, MarcadorMapa } from '../../../shared/mapa/mapa';
import { EncontrosLista } from './encontros-lista';
import { provideApiFalsa } from '../../../testes/api-falsa';

describe('EncontrosLista', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EncontrosLista],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  async function criar() {
    const fixture = TestBed.createComponent(EncontrosLista);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function itens(fixture: Fixture) {
    return [...fixture.nativeElement.querySelectorAll('.list > li')] as HTMLElement[];
  }

  function aba(fixture: Fixture, texto: string) {
    return ([...fixture.nativeElement.querySelectorAll('.tabs__item')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === texto,
    )!;
  }

  function mapa(fixture: Fixture) {
    return fixture.debugElement.query(By.directive(Mapa));
  }

  function marcadores(fixture: Fixture): MarcadorMapa[] {
    return (mapa(fixture).componentInstance as Mapa).marcadores();
  }

  it('lista todos os encontros com link para o detalhe e um marcador para cada', async () => {
    const fixture = await criar();
    const total = TestBed.inject(EncontrosService).encontros().length;

    expect(itens(fixture).length).toBe(total);
    expect(itens(fixture)[0].querySelector('a')?.getAttribute('href')).toMatch(/^\/encontros\/\d+$/);
    expect(marcadores(fixture).length).toBe(total);
    expect(aba(fixture, 'Todos').getAttribute('aria-pressed')).toBe('true');
  });

  it('filtra só os encontros confirmados na aba "Vou"', async () => {
    const fixture = await criar();
    const confirmados = TestBed.inject(EncontrosService).confirmados();

    aba(fixture, 'Vou').click();
    await fixture.whenStable();

    expect(aba(fixture, 'Vou').getAttribute('aria-pressed')).toBe('true');
    expect(itens(fixture).length).toBe(confirmados.length);
    expect(marcadores(fixture).map((m) => m.id)).toEqual(confirmados.map((e) => e.id));
  });

  it('mostra o estado vazio quando nenhum encontro está confirmado', async () => {
    const service = TestBed.inject(EncontrosService);
    service.carregar();
    for (const e of service.confirmados()) service.alternarPresenca(e.id);
    const fixture = await criar();

    aba(fixture, 'Vou').click();
    await fixture.whenStable();

    expect(itens(fixture).length).toBe(0);
    expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain('não confirmou');
  });

  it('alterna a presença pelo chip e atualiza a contagem', async () => {
    const fixture = await criar();
    const service = TestBed.inject(EncontrosService);
    const alvo = service.encontros().find((e) => !e.vou)!;
    const item = () => fixture.nativeElement.querySelector(`#encontro-${alvo.id}`) as HTMLElement;
    const chip = () => item().querySelector('.chip') as HTMLButtonElement;

    expect(chip().getAttribute('aria-pressed')).toBe('false');
    chip().click();
    await fixture.whenStable();

    expect(chip().getAttribute('aria-pressed')).toBe('true');
    expect(chip().textContent).toContain('Vou ✓');
    expect(item().querySelector('.item__meta')?.textContent).toContain(
      `${alvo.confirmados + 1} pets`,
    );
    expect(service.porId(alvo.id)?.vou).toBe(true);
  });

  it('destaca o marcador ao passar o mouse e o item ao clicar no marcador', async () => {
    const fixture = await criar();
    const [primeiro, segundo] = itens(fixture);
    const idPrimeiro = Number(primeiro.id.replace('encontro-', ''));
    const idSegundo = Number(segundo.id.replace('encontro-', ''));

    primeiro.dispatchEvent(new Event('mouseenter'));
    await fixture.whenStable();
    expect(marcadores(fixture).find((m) => m.tipo === 'destaque')?.id).toBe(idPrimeiro);

    mapa(fixture).triggerEventHandler('marcadorClicado', idSegundo);
    await fixture.whenStable();
    expect(itens(fixture)[1].classList).toContain('encontros__item--ativo');
    expect(marcadores(fixture).filter((m) => m.tipo === 'destaque').map((m) => m.id)).toEqual([
      idSegundo,
    ]);
  });
});
