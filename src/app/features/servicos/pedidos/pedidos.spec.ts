import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ServicosService } from '../../../core/servicos.service';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { Pedidos } from './pedidos';

describe('Pedidos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pedidos],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  async function criar(papel?: string) {
    const fixture = TestBed.createComponent(Pedidos);
    if (papel) fixture.componentRef.setInput('papel', papel);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.pedido')).not.toBeNull();
    });
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  const pedidos = (fixture: Fixture) =>
    [...fixture.nativeElement.querySelectorAll('.pedido')] as HTMLElement[];

  function botao(raiz: HTMLElement, texto: string) {
    return ([...raiz.querySelectorAll('button')] as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === texto,
    );
  }

  it('mostra os pedidos feitos, com status e o contato só nos que estão em aberto', async () => {
    const fixture = await criar();
    const [concluido, pendente] = pedidos(fixture);

    expect(concluido.querySelector('.item__title')?.textContent).toContain('Ana Passeios');
    expect(concluido.querySelector('.pedido__status')?.textContent).toContain('Concluído');
    expect(concluido.querySelector('.pedido__contato')).toBeNull();

    expect(pendente.querySelector('.pedido__status')?.textContent).toContain('Aguardando');
    expect(pendente.querySelector('.pedido__quando')?.textContent).toContain('até');
    expect(pendente.querySelector('.pedido__contato')?.textContent).toContain('rafael@exemplo.com');
    expect(botao(pendente, 'Cancelar pedido')).toBeDefined();
  });

  it('o cliente avalia um serviço concluído', async () => {
    const fixture = await criar();
    const avaliar = vi.spyOn(TestBed.inject(ServicosService), 'avaliar');

    botao(pedidos(fixture)[0], 'Avaliar Ana Passeios')!.click();
    await fixture.whenStable();

    const form = fixture.nativeElement.querySelector('.avaliar') as HTMLFormElement;
    // Sem nota, não envia.
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(avaliar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.alert')?.textContent).toContain('estrelas');

    const quatro = form.querySelectorAll('input[type=radio]')[3] as HTMLInputElement;
    quatro.click();
    const comentario = form.querySelector('textarea') as HTMLTextAreaElement;
    comentario.value = ' Muito cuidadosa ';
    comentario.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(pedidos(fixture)[0].querySelector('.pedido__avaliacao')?.textContent).toContain(
        'Muito cuidadosa',
      );
    });
    expect(avaliar).toHaveBeenCalledWith(1, 4, 'Muito cuidadosa');
  });

  it('o prestador vê os pedidos recebidos e aceita', async () => {
    const fixture = await criar('prestador');
    const mudarStatus = vi.spyOn(TestBed.inject(ServicosService), 'mudarStatus');
    const [recebido] = pedidos(fixture);

    expect(pedidos(fixture)).toHaveLength(2);
    expect(recebido.querySelector('.item__title')?.textContent).toContain('Bia');
    expect(recebido.querySelector('.pedido__contato')?.textContent).toContain('(21) 96666-0000');
    expect(botao(recebido, 'Recusar')).toBeDefined();

    botao(recebido, 'Aceitar')!.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(pedidos(fixture)[0].querySelector('.pedido__status')?.textContent).toContain('Aceito');
    });
    expect(mudarStatus).toHaveBeenCalledWith(3, 'aceita');
    // Passeio não se conclui por aqui: começa e termina na tela ao vivo.
    const aceito = pedidos(fixture)[0];
    expect(botao(aceito, 'Concluir')).toBeUndefined();
    expect(aceito.querySelector('a.btn')?.textContent?.trim()).toBe('Iniciar passeio');
    expect(aceito.querySelector('a.btn')?.getAttribute('href')).toBe('/servicos/pedidos/3/ao-vivo');
  });

  it('leva o tutor para acompanhar o passeio em andamento e para ver o trajeto depois', async () => {
    const fixture = await criar();
    const [concluido, , andando] = pedidos(fixture);

    expect(andando.querySelector('.pedido__status')?.textContent).toContain('em andamento');
    expect(andando.querySelector('a.btn')?.textContent?.trim()).toBe('Acompanhar ao vivo');
    expect(andando.querySelector('.pedido__contato')).not.toBeNull();
    // Durante o passeio o pet está com o passeador: ninguém cancela.
    expect(botao(andando, 'Cancelar pedido')).toBeUndefined();
    expect(concluido.querySelector('a.btn')?.textContent?.trim()).toBe('Ver trajeto');
  });

  it('troca de aba entre os pedidos feitos e os recebidos', async () => {
    const fixture = await criar();
    expect(pedidos(fixture)).toHaveLength(3);

    botao(fixture.nativeElement, 'Que recebi')!.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(pedidos(fixture)).toHaveLength(2);
    });
  });
});
