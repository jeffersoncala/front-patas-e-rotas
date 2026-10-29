import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideApiFalsa } from '../../../testes/api-falsa';
import { MeusServicos } from './meus-servicos';

describe('MeusServicos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeusServicos],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  async function criar() {
    const fixture = TestBed.createComponent(MeusServicos);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.meu')).not.toBeNull();
    });
    return fixture;
  }

  it('lista os serviços do tutor e oferece só os tipos que faltam', async () => {
    const fixture = await criar();
    const el = fixture.nativeElement as HTMLElement;

    expect([...el.querySelectorAll('.meu .item__title')].map((a) => a.textContent)).toEqual([
      'Jeff Passeios',
    ]);
    expect(
      [...el.querySelectorAll('.oferecer a')].map((a) => [
        a.textContent?.trim(),
        a.getAttribute('href'),
      ]),
    ).toEqual([
      ['Hospedagem', '/servicos/novo?tipo=anfitriao'],
      ['Banho e tosa', '/servicos/novo?tipo=petshop'],
    ]);
  });

  it('pausa e reativa um serviço', async () => {
    const fixture = await criar();
    const botao = () =>
      ([...fixture.nativeElement.querySelectorAll('.meu button')] as HTMLButtonElement[])[0];

    expect(botao().textContent).toContain('Pausar');
    botao().click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(botao().textContent).toContain('Reativar');
    });
    expect(fixture.nativeElement.querySelector('.meu__pausado')).not.toBeNull();
  });
});
