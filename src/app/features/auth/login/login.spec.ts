import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function criar() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  function input(fixture: ReturnType<typeof criar>, id: string) {
    return fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
  }

  function digitar(el: HTMLInputElement, valor: string) {
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  it('mostra o título de boas-vindas', () => {
    const compiled = criar().nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bem-vindo de volta');
  });

  it('não navega e marca os erros quando o formulário está vazio', async () => {
    const fixture = criar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await fixture.whenStable();

    expect(navegar).not.toHaveBeenCalled();
    const erros = fixture.nativeElement.querySelectorAll('.field__error');
    expect(erros.length).toBe(2);
  });

  it('acusa e-mail inválido e limpa o erro quando corrigido', async () => {
    const fixture = criar();
    const email = input(fixture, 'email');

    digitar(email, 'nao-e-email');
    email.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#email-erro')?.textContent).toContain(
      'não parece válido',
    );

    digitar(email, 'tutor@exemplo.com');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#email-erro')).toBeNull();
  });

  it('alterna a visibilidade da senha', async () => {
    const fixture = criar();
    const senha = input(fixture, 'senha');
    expect(senha.type).toBe('password');

    (fixture.nativeElement.querySelector('.field__toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(input(fixture, 'senha').type).toBe('text');
  });

  it('navega para a home quando as credenciais são válidas', async () => {
    const fixture = criar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    digitar(input(fixture, 'email'), 'tutor@exemplo.com');
    digitar(input(fixture, 'senha'), 'segredo123');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
  });
});
