import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { RecuperarSenha } from './recuperar-senha';
import { provideApiFalsa } from '../../../testes/api-falsa';

describe('RecuperarSenha', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecuperarSenha],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  function criar() {
    const fixture = TestBed.createComponent(RecuperarSenha);
    fixture.detectChanges();
    return fixture;
  }

  function digitar(fixture: ReturnType<typeof criar>, valor: string) {
    const input = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function enviar(fixture: ReturnType<typeof criar>) {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
  }

  it('não envia e pede o e-mail quando o campo está vazio', async () => {
    const fixture = criar();
    const recuperar = vi.spyOn(TestBed.inject(AuthService), 'recuperarSenha');

    enviar(fixture);
    await fixture.whenStable();

    expect(recuperar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#email-erro')?.textContent).toContain(
      'Informe o e-mail',
    );
  });

  it('acusa e-mail inválido', async () => {
    const fixture = criar();
    const recuperar = vi.spyOn(TestBed.inject(AuthService), 'recuperarSenha');

    digitar(fixture, 'nao-e-email');
    enviar(fixture);
    await fixture.whenStable();

    expect(recuperar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#email-erro')?.textContent).toContain(
      'não parece válido',
    );
  });

  it('mostra a confirmação com o e-mail informado e o link de volta ao login', async () => {
    const fixture = criar();
    const recuperar = vi
      .spyOn(TestBed.inject(AuthService), 'recuperarSenha')
      .mockResolvedValue();

    digitar(fixture, 'tutor@exemplo.com');
    enviar(fixture);

    await vi.waitFor(() => {
      fixture.detectChanges();
      const status = fixture.nativeElement.querySelector('[role="status"] .alert--sucesso');
      expect(status?.textContent).toContain('tutor@exemplo.com');
    });
    expect(recuperar).toHaveBeenCalledWith('tutor@exemplo.com');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    const voltar = fixture.nativeElement.querySelector('a[href="/login"]');
    expect(voltar?.textContent).toContain('Voltar para o login');
  });
});
