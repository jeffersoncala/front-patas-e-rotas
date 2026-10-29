import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ServicosService } from '../../../core/servicos.service';
import { entrarComoExemplo, provideApiFalsa } from '../../../testes/api-falsa';
import { PrestadorDetalhe } from './prestador-detalhe';

describe('PrestadorDetalhe', () => {
  beforeEach(async () => {
    entrarComoExemplo();
    await TestBed.configureTestingModule({
      imports: [PrestadorDetalhe],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  async function criar(id: number) {
    const fixture = TestBed.createComponent(PrestadorDetalhe);
    fixture.componentRef.setInput('id', id);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
    });
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

  it('mostra preços, contato e avaliações', async () => {
    const fixture = await criar(1);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('Ana Passeios');
    expect(el.querySelector('.precos')?.textContent).toMatch(/Passeio de 30 min\s*R\$\s25,00/);
    expect(
      [...el.querySelectorAll('.detalhe__contato a')].map((a) => a.getAttribute('href')),
    ).toEqual(['tel:+5521988881111', 'https://wa.me/5521988881111']);
    expect(el.querySelector('.avaliacao')?.textContent).toContain('Pontual e mandou fotos.');
    expect(el.querySelector('.galeria img')).not.toBeNull();
  });

  it('pede o serviço com o pet do perfil e vai para os pedidos', async () => {
    const fixture = await criar(1);
    const contratar = vi.spyOn(TestBed.inject(ServicosService), 'contratar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    // Com um pet só, ele já vem marcado; e passeio não tem data de saída.
    expect(fixture.nativeElement.querySelector('#fim')).toBeNull();
    digitar(fixture, 'inicio', '2999-01-10T08:30');
    digitar(fixture, 'contato', ' (21) 97777-0000 ');
    digitar(fixture, 'mensagem', 'Ele puxa');
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith(['/servicos/pedidos']));
    expect(contratar).toHaveBeenCalledWith({
      prestadorId: 1,
      petIds: [1],
      inicio: new Date('2999-01-10T08:30').toISOString(),
      contato: '(21) 97777-0000',
      mensagem: 'Ele puxa',
    });
  });

  it('na hospedagem exige a saída depois da entrada', async () => {
    const fixture = await criar(2);
    const contratar = vi.spyOn(TestBed.inject(ServicosService), 'contratar');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    digitar(fixture, 'inicio', '2999-01-10T10:00');
    digitar(fixture, 'fim', '2999-01-09T10:00');
    digitar(fixture, 'contato', '21 97777-0000');
    enviar(fixture);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#fim-erro')?.textContent).toContain('depois');
    expect(contratar).not.toHaveBeenCalled();

    digitar(fixture, 'fim', '2999-01-12T18:00');
    enviar(fixture);
    await vi.waitFor(() => expect(contratar).toHaveBeenCalled());
    expect(contratar.mock.calls[0][0].fim).toBe(new Date('2999-01-12T18:00').toISOString());
  });

  it('recusa data no passado e pede o telefone', async () => {
    const fixture = await criar(1);
    const contratar = vi.spyOn(TestBed.inject(ServicosService), 'contratar');

    digitar(fixture, 'inicio', '2000-01-01T10:00');
    enviar(fixture);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#inicio-erro')?.textContent).toContain('a partir de agora');
    expect(el.querySelector('#contato-erro')).not.toBeNull();
    expect(contratar).not.toHaveBeenCalled();
  });

  it('no próprio serviço mostra o link de editar, sem o formulário de pedido', async () => {
    const fixture = await criar(4);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.perfil__editar')?.getAttribute('href')).toBe('/servicos/4/editar');
    expect(el.querySelector('.avaliacoes, .vazio')?.textContent).toContain('Ainda sem avaliações');
  });
});
