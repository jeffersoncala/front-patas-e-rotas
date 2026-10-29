import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { REDUZIR_IMAGEM } from '../../../core/imagem';
import { LatLng } from '../../../core/models';
import { ServicosService } from '../../../core/servicos.service';
import { Mapa } from '../../../shared/mapa/mapa';
import { entrarComoExemplo, provideApiFalsa } from '../../../testes/api-falsa';
import { EditarPrestador } from './editar-prestador';

const FOTO = 'data:image/jpeg;base64,/9j/AAAA';

describe('EditarPrestador', () => {
  beforeEach(async () => {
    entrarComoExemplo();
    await TestBed.configureTestingModule({
      imports: [EditarPrestador],
      providers: [
        provideRouter([]),
        provideApiFalsa(),
        { provide: REDUZIR_IMAGEM, useValue: async () => FOTO },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  async function criar(inputs: { id?: string; tipo?: string } = {}) {
    const fixture = TestBed.createComponent(EditarPrestador);
    for (const [nome, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nome, valor);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function digitar(fixture: Fixture, id: string, valor: string) {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = valor;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    el.dispatchEvent(new Event('blur'));
  }

  function clicar(fixture: Fixture, texto: string) {
    const botao = (
      [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === texto)!;
    botao.click();
  }

  function enviar(fixture: Fixture) {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
  }

  function clicarNoMapa(fixture: Fixture, posicao: LatLng) {
    fixture.debugElement.query(By.directive(Mapa)).triggerEventHandler('cliqueMapa', posicao);
  }

  async function escolherFoto(fixture: Fixture) {
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'quintal.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.foto img')).not.toBeNull();
    });
  }

  it('cadastra com o tipo da URL, preços e fotos, e abre o serviço criado', async () => {
    const fixture = await criar({ tipo: 'anfitriao' });
    const criarPrestador = vi.spyOn(TestBed.inject(ServicosService), 'criar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    // O nome já vem com o do tutor.
    expect((fixture.nativeElement.querySelector('#nome') as HTMLInputElement).value).toBe('Jeff');
    expect((fixture.nativeElement.querySelector('#tipo') as HTMLSelectElement).value).toBe(
      'anfitriao',
    );

    await escolherFoto(fixture);
    digitar(fixture, 'descricao', ' Quintal grande ');
    digitar(fixture, 'contato', '(21) 97777-0000');
    digitar(fixture, 'bairro', 'Flamengo');
    clicar(fixture, '+ Adicionar preço');
    await fixture.whenStable();
    digitar(fixture, 'preco-descricao-0', 'Diária');
    digitar(fixture, 'preco-valor-0', '1.200,5');
    clicarNoMapa(fixture, [-22.93, -43.18]);
    enviar(fixture);

    await vi.waitFor(() => expect(criarPrestador).toHaveBeenCalled());
    expect(criarPrestador).toHaveBeenCalledWith({
      tipo: 'anfitriao',
      nome: 'Jeff',
      descricao: 'Quintal grande',
      contato: '(21) 97777-0000',
      bairro: 'Flamengo',
      posicao: [-22.93, -43.18],
      precos: [{ descricao: 'Diária', valorCentavos: 120050 }],
      fotos: [FOTO],
    });
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith(['/servicos', 5]));
  });

  it('marca os erros, inclusive de preço, e não envia', async () => {
    const fixture = await criar();
    const criarPrestador = vi.spyOn(TestBed.inject(ServicosService), 'criar');

    digitar(fixture, 'nome', ' ');
    clicar(fixture, '+ Adicionar preço');
    await fixture.whenStable();
    digitar(fixture, 'preco-valor-0', 'vinte');
    enviar(fixture);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#nome-erro')).not.toBeNull();
    expect(el.querySelector('#contato-erro')).not.toBeNull();
    expect(el.querySelector('#bairro-erro')).not.toBeNull();
    expect(el.querySelector('#posicao-erro')).not.toBeNull();
    expect(el.querySelector('.precos')?.textContent).toContain('Descreva o que está sendo cobrado');
    expect(el.querySelector('.precos')?.textContent).toContain('Use um valor como 25');
    expect(criarPrestador).not.toHaveBeenCalled();
  });

  it('edita um serviço existente, sem trocar o tipo', async () => {
    const fixture = await criar({ id: '4' });
    const alterar = vi.spyOn(TestBed.inject(ServicosService), 'alterar');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#tipo')).toBeNull();
    expect((el.querySelector('#nome') as HTMLInputElement).value).toBe('Jeff Passeios');
    expect((el.querySelector('#preco-valor-0') as HTMLInputElement).value).toBe('30,00');

    digitar(fixture, 'bairro', 'Catete');
    enviar(fixture);

    await vi.waitFor(() => expect(alterar).toHaveBeenCalled());
    expect(alterar).toHaveBeenCalledWith(4, {
      nome: 'Jeff Passeios',
      descricao: '',
      contato: '(21) 97777-0000',
      bairro: 'Catete',
      posicao: [-22.9275, -43.1795],
      precos: [{ descricao: 'Passeio', valorCentavos: 3000 }],
      fotos: [],
    });
  });

  it('não deixa editar o serviço de outro tutor', async () => {
    const fixture = TestBed.createComponent(EditarPrestador);
    fixture.componentRef.setInput('id', '1');
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.vazio')?.textContent).toContain('não é seu');
    });
  });
});
