import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { REDUZIR_IMAGEM } from '../../../core/imagem';
import { Cadastro } from './cadastro';
import { provideApiFalsa } from '../../../testes/api-falsa';

const IMAGEM = 'data:image/jpeg;base64,/9j/AA==';

describe('Cadastro', () => {
  let reduzir: ReturnType<typeof vi.fn<(arquivo: Blob) => Promise<string>>>;

  beforeEach(async () => {
    reduzir = vi.fn(async () => IMAGEM);
    await TestBed.configureTestingModule({
      imports: [Cadastro],
      providers: [
        provideRouter([]),
        provideApiFalsa(),
        { provide: REDUZIR_IMAGEM, useValue: reduzir },
      ],
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

  function botao(fixture: Fixture, texto: string) {
    const achado = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.replace(/\s+/g, ' ').includes(texto));
    if (!achado) throw new Error(`Botão "${texto}" não encontrado`);
    return achado;
  }

  function enviar(fixture: Fixture) {
    el<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  }

  function preencher(fixture: Fixture) {
    digitar(fixture, 'tutor', 'Jeff');
    digitar(fixture, 'email', 'tutor@exemplo.com');
    digitar(fixture, 'senha', 'segredo123');
    el<HTMLInputElement>(fixture, '#termos').click();
  }

  /** Clica em "Escolher foto" e simula o tutor escolhendo um arquivo. */
  async function escolherFoto(fixture: Fixture) {
    const seletor = el<HTMLInputElement>(fixture, 'input[type="file"]');
    const abrir = vi.spyOn(seletor, 'click').mockImplementation(() => undefined);
    botao(fixture, 'Escolher foto').click();
    expect(abrir).toHaveBeenCalled();

    const arquivo = new File(['x'], 'eu.jpg', { type: 'image/jpeg' });
    Object.defineProperty(seletor, 'files', { value: [arquivo], configurable: true });
    seletor.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(reduzir).toHaveBeenCalledWith(arquivo));
    await fixture.whenStable();
  }

  it('mostra o título do cadastro, sem campos de pet', () => {
    const fixture = criar();
    expect(el(fixture, 'h1').textContent).toContain('Crie sua conta');
    expect(el(fixture, '#pet')).toBeNull();
  });

  it('não cadastra e marca todos os erros quando o formulário está vazio', async () => {
    const fixture = criar();
    const cadastrar = vi.spyOn(TestBed.inject(AuthService), 'cadastrar');

    enviar(fixture);
    await fixture.whenStable();

    expect(cadastrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.field__error').length).toBe(4);
    expect(el(fixture, '#termos-erro').textContent).toContain('aceitar os termos');
  });

  it('exige senha com ao menos 6 caracteres', async () => {
    const fixture = criar();
    digitar(fixture, 'senha', '123');
    el(fixture, '#senha').dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(el(fixture, '#senha-erro').textContent).toContain('ao menos 6 caracteres');
  });

  it('cria a conta só com os dados do tutor e navega para a home', async () => {
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
    });
  });

  it('envia a foto do tutor junto, e não envia depois de removida', async () => {
    const fixture = criar();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const cadastrar = vi.spyOn(TestBed.inject(AuthService), 'cadastrar').mockResolvedValue();

    preencher(fixture);
    await escolherFoto(fixture);
    expect(el(fixture, '.foto-campo img').getAttribute('src')).toBe(IMAGEM);

    enviar(fixture);
    await vi.waitFor(() => expect(cadastrar).toHaveBeenCalledTimes(1));
    expect(cadastrar.mock.calls[0][0]).toEqual(expect.objectContaining({ fotoTutor: IMAGEM }));

    botao(fixture, 'Remover foto').click();
    await fixture.whenStable();
    expect(el(fixture, '.foto-campo img')).toBeNull();
    enviar(fixture);
    await vi.waitFor(() => expect(cadastrar).toHaveBeenCalledTimes(2));
    expect(cadastrar.mock.calls[1][0]).not.toHaveProperty('fotoTutor');
  });

  it('avisa quando o arquivo escolhido não é uma imagem', async () => {
    const fixture = criar();
    reduzir.mockRejectedValueOnce(new Error('Escolha um arquivo de imagem.'));

    await escolherFoto(fixture);

    expect(el(fixture, '#foto-erro').textContent).toContain('Escolha um arquivo de imagem.');
    expect(el(fixture, '.foto-campo img')).toBeNull();
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
