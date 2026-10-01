import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { entrarComoExemplo, provideApiFalsa } from './testes/api-falsa';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideApiFalsa()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('manda quem não entrou para o login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/encontros');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('libera as telas internas e bloqueia o login para quem já entrou', async () => {
    entrarComoExemplo();
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/perfil');
    expect(router.url).toBe('/perfil');

    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/');
  });
});
