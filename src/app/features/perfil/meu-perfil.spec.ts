import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Perfil } from '../../core/models';
import { MeuPerfil } from './meu-perfil';
import { entrarComoExemplo, provideApiFalsa } from '../../testes/api-falsa';

const PERFIL: Perfil = {
  tutor: 'Jeff',
  email: 'tutor@exemplo.com',
  pet: 'Bolota',
  especie: 'cachorro',
  raca: 'Vira-lata',
  idadeAnos: 4,
  porte: 'medio',
  bio: 'Adora petiscos.',
  metaSemanalKm: 15,
};

describe('MeuPerfil', () => {
  beforeEach(async () => {
    entrarComoExemplo(PERFIL);
    await TestBed.configureTestingModule({
      imports: [MeuPerfil],
      providers: [provideRouter([]), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  function criar() {
    const fixture = TestBed.createComponent(MeuPerfil);
    fixture.detectChanges();
    return fixture;
  }

  function botao(el: HTMLElement, texto: string) {
    return [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(texto),
    )!;
  }

  it('mostra os dados do pet e o histórico de passeios', () => {
    const el = criar().nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Bolota');
    expect(el.querySelectorAll('.passeio').length).toBe(2);
  });

  it('não salva com nome vazio e salva as alterações válidas', async () => {
    const fixture = criar();
    const el = fixture.nativeElement as HTMLElement;
    const auth = TestBed.inject(AuthService);
    const atualizar = vi.spyOn(auth, 'atualizarPerfil').mockResolvedValue();

    botao(el, 'Editar perfil').click();
    await fixture.whenStable();

    const pet = el.querySelector<HTMLInputElement>('#pet')!;
    pet.value = '';
    pet.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(atualizar).not.toHaveBeenCalled();
    expect(el.querySelector('#pet-erro')).not.toBeNull();

    pet.value = 'Bolinha';
    pet.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(atualizar).toHaveBeenCalledWith(expect.objectContaining({ pet: 'Bolinha' }));
  });

  it('sai da conta e volta para o login', async () => {
    const fixture = criar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    botao(fixture.nativeElement, 'Sair').click();
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith('/login');
  });
});
