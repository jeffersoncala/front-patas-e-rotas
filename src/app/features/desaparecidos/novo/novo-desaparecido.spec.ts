import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { DesaparecidosService } from '../../../core/desaparecidos.service';
import { REDUZIR_IMAGEM } from '../../../core/imagem';
import { LatLng } from '../../../core/models';
import { Mapa } from '../../../shared/mapa/mapa';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { NovoDesaparecido } from './novo-desaparecido';

const FOTO = 'data:image/jpeg;base64,/9j/AAAA';

describe('NovoDesaparecido', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NovoDesaparecido],
      providers: [
        provideRouter([]),
        provideApiFalsa(),
        { provide: REDUZIR_IMAGEM, useValue: async () => FOTO },
      ],
    }).compileComponents();
  });

  async function criar() {
    const fixture = TestBed.createComponent(NovoDesaparecido);
    await fixture.whenStable();
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof criar>>;

  function digitar(fixture: Fixture, id: string, valor: string) {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = valor;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    el.dispatchEvent(new Event('blur'));
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
      value: [new File(['x'], 'mel.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.novo__foto-preview img')).not.toBeNull();
    });
  }

  it('marca os erros e não cadastra quando faltam dados', async () => {
    const fixture = await criar();
    const criarDesaparecido = vi.spyOn(TestBed.inject(DesaparecidosService), 'criar');

    enviar(fixture);
    await fixture.whenStable();

    expect(criarDesaparecido).not.toHaveBeenCalled();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#nome-erro')).not.toBeNull();
    expect(el.querySelector('#contato-erro')).not.toBeNull();
    expect(el.querySelector('#posicao-erro')?.textContent).toContain('Toque no mapa');
    // A data já vem preenchida com agora.
    expect(el.querySelector('#vistoEm-erro')).toBeNull();
  });

  it('recusa data no futuro', async () => {
    const fixture = await criar();

    digitar(fixture, 'vistoEm', '2999-01-01T10:00');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#vistoEm-erro')?.textContent).toContain('futuro');
  });

  it('cadastra com foto e volta para a lista', async () => {
    const fixture = await criar();
    const criarDesaparecido = vi.spyOn(TestBed.inject(DesaparecidosService), 'criar');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await escolherFoto(fixture);
    digitar(fixture, 'nome', '  Mel ');
    digitar(fixture, 'especie', 'gato');
    digitar(fixture, 'porte', 'pequeno');
    digitar(fixture, 'raca', 'Siamês');
    digitar(fixture, 'descricao', 'Coleira rosa');
    digitar(fixture, 'contato', '(21) 99999-0000');
    digitar(fixture, 'vistoEm', '2026-01-10T08:30');
    clicarNoMapa(fixture, [-22.93, -43.18]);
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith(['/desaparecidos']));
    expect(criarDesaparecido).toHaveBeenCalledWith({
      nome: 'Mel',
      especie: 'gato',
      porte: 'pequeno',
      raca: 'Siamês',
      descricao: 'Coleira rosa',
      contato: '(21) 99999-0000',
      posicao: [-22.93, -43.18],
      vistoEm: new Date('2026-01-10T08:30').toISOString(),
      foto: FOTO,
    });
  });

  it('cadastra sem foto quando o tutor remove a escolhida', async () => {
    const fixture = await criar();
    const criarDesaparecido = vi.spyOn(TestBed.inject(DesaparecidosService), 'criar');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await escolherFoto(fixture);
    const remover = [...fixture.nativeElement.querySelectorAll('.novo__foto button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Remover',
    ) as HTMLButtonElement;
    remover.click();
    digitar(fixture, 'nome', 'Thor');
    digitar(fixture, 'contato', 'Portaria');
    clicarNoMapa(fixture, [-22.93, -43.18]);
    enviar(fixture);

    await vi.waitFor(() => expect(criarDesaparecido).toHaveBeenCalled());
    expect(criarDesaparecido.mock.calls[0][0]).not.toHaveProperty('foto');
  });
});
