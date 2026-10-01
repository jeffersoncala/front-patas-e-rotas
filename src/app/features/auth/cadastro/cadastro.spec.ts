import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { Cadastro } from './cadastro';
import { provideApiFalsa } from '../../../testes/api-falsa';

describe('Cadastro', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cadastro],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  function criar() {
    const fixture = TestBed.createComponent(Cadastro);
    fixture.detectChanges();
    return fixture;
  }

  type Fixture = ReturnType<typeof criar>;

  function el<T extends HTMLElement>(fixture: Fixture, seletor: string) {
    return fixture.nativeElement.querySelector(seletor) as T;
  }

  function digitar(fixture: Fixture, id: string, valor: string) {
    const input = el<HTMLInputElement>(fixture, `#${id}`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function opcao(fixture: Fixture, grupo: string, texto: string) {
    const opcoes = Array.from(
      fixture.nativeElement.querySelectorAll(
        `[aria-labelledby="${grupo}-label"] [role="radio"]`,
      ) as NodeListOf<HTMLButtonElement>,
    );
    return opcoes.find((botao) => botao.textContent?.trim() === texto)!;
  }

  function enviar(fixture: Fixture) {
    el<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  }

  function preencher(fixture: Fixture) {
    digitar(fixture, 'tutor', 'Jeff');
    digitar(fixture, 'email', 'tutor@exemplo.com');
    digitar(fixture, 'senha', 'segredo123');
    digitar(fixture, 'pet', 'Bolota');
    opcao(fixture, 'especie', 'Gato').click();
    opcao(fixture, 'porte', 'Pequeno').click();
    el<HTMLInputElement>(fixture, '#termos').click();
  }

  it('mostra o título do cadastro', () => {
    expect(el(criar(), 'h1').textContent).toContain('Crie o perfil do seu pet');
  });

  it('não cadastra e marca todos os erros quando o formulário está vazio', async () => {
    const fixture = criar();
    const cadastrar = vi.spyOn(TestBed.inject(AuthService), 'cadastrar');

    enviar(fixture);
    await fixture.whenStable();

    expect(cadastrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.field__error').length).toBe(7);
    expect(el(fixture, '#termos-erro').textContent).toContain('aceitar os termos');
  });

  it('exige senha com ao menos 6 caracteres', async () => {
    const fixture = criar();
    digitar(fixture, 'senha', '123');
    el(fixture, '#senha').dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(el(fixture, '#senha-erro').textContent).toContain('ao menos 6 caracteres');
  });

  it('marca a opção escolhida no grupo e navega com as setas', async () => {
    const fixture = criar();
    const cachorro = opcao(fixture, 'especie', 'Cachorro');
    expect(cachorro.getAttribute('aria-checked')).toBe('false');
    expect(cachorro.tabIndex).toBe(0);

    cachorro.click();
    await fixture.whenStable();
    expect(cachorro.getAttribute('aria-checked')).toBe('true');

    cachorro.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(opcao(fixture, 'especie', 'Gato').getAttribute('aria-checked')).toBe('true');
    expect(cachorro.getAttribute('aria-checked')).toBe('false');
    expect(cachorro.tabIndex).toBe(-1);
  });

  it('cria a conta e navega para a home quando tudo está preenchido', async () => {
    const fixture = criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const cadastrar = vi.spyOn(TestBed.inject(AuthService), 'cadastrar').mockResolvedValue();

    preencher(fixture);
    await fixture.whenStable();
    enviar(fixture);

    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
    expect(cadastrar).toHaveBeenCalledWith({
      tutor: 'Jeff',
      email: 'tutor@exemplo.com',
      senha: 'segredo123',
      pet: 'Bolota',
      especie: 'gato',
      porte: 'pequeno',
    });
  });

  it('mostra um erro geral quando o cadastro falha', async () => {
    const fixture = criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    vi.spyOn(TestBed.inject(AuthService), 'cadastrar').mockRejectedValue(new Error('falhou'));

    preencher(fixture);
    enviar(fixture);

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el(fixture, '.alert[role="alert"]')?.textContent).toContain('Não foi possível');
    });
    expect(navegar).not.toHaveBeenCalled();
  });
});
