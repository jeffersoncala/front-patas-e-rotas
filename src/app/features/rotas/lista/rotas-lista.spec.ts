import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RotasService } from '../../../core/rotas.service';
import { Mapa, TrajetoMapa } from '../../../shared/mapa/mapa';
import { RotasLista } from './rotas-lista';
import { provideApiFalsa } from '../../../testes/api-falsa';

describe('RotasLista', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotasLista],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  async function criar() {
    const fixture = TestBed.createComponent(RotasLista);
    await fixture.whenStable();
    return fixture;
  }

  function itens(fixture: Awaited<ReturnType<typeof criar>>): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.list > li'));
  }

  function abas(fixture: Awaited<ReturnType<typeof criar>>): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.tabs__item'));
  }

  it('lista todas as rotas com link para o detalhe', async () => {
    const fixture = await criar();
    const total = TestBed.inject(RotasService).rotas().length;

    expect(itens(fixture).length).toBe(total);
    const link = itens(fixture)[0].querySelector('a.item__title') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/rotas/1');
    expect(abas(fixture)[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('filtra só as favoritas', async () => {
    const fixture = await criar();
    const favoritas = TestBed.inject(RotasService).favoritas().length;

    abas(fixture)[1].click();
    await fixture.whenStable();

    expect(abas(fixture)[1].getAttribute('aria-pressed')).toBe('true');
    expect(itens(fixture).length).toBe(favoritas);
    expect(fixture.nativeElement.textContent).not.toContain('Reta do Aterro');
  });

  it('favorita e desfavorita pelo botão', async () => {
    const fixture = await criar();
    const service = TestBed.inject(RotasService);
    const botao = itens(fixture)[3].querySelector('.favoritar') as HTMLButtonElement;
    expect(botao.getAttribute('aria-pressed')).toBe('false');

    botao.click();
    await fixture.whenStable();

    expect(service.porId(4)?.favorita).toBe(true);
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });

  it('mostra estado vazio quando não há favoritas', async () => {
    const service = TestBed.inject(RotasService);
    service.carregar();
    for (const rota of service.favoritas()) service.alternarFavorita(rota.id);
    const fixture = await criar();

    abas(fixture)[1].click();
    await fixture.whenStable();

    expect(itens(fixture).length).toBe(0);
    expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain(
      'Nenhuma rota favorita',
    );
  });

  it('destaca no mapa a rota clicada e marca o início', async () => {
    const fixture = await criar();
    const mapa = fixture.debugElement.query(By.directive(Mapa)).componentInstance as Mapa;

    itens(fixture)[1].click();
    await fixture.whenStable();

    const destacados = mapa.trajetos().filter((t: TrajetoMapa) => t.destaque);
    expect(destacados.map((t) => t.id)).toEqual([2]);
    expect(mapa.marcadores().length).toBe(1);
    expect(mapa.marcadores()[0].posicao).toEqual(TestBed.inject(RotasService).porId(2)!.pontos[0]);
  });
});
