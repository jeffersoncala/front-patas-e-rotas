import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../core/api';
import { Avatar } from './avatar';

describe('Avatar', () => {
  function criar(foto: string | null, nome = 'bolota') {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('foto', foto);
    fixture.componentRef.setInput('nome', nome);
    fixture.detectChanges();
    return fixture;
  }

  it('mostra a inicial quando não há foto', () => {
    const fixture = criar(null);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('B');
  });

  it('mostra a foto pelo endereço da API e volta para a inicial se ela falhar', async () => {
    const fixture = criar('/fotos/abc');
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(`${API_URL}/fotos/abc`);

    img.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe('B');

    // Uma foto nova tenta de novo.
    fixture.componentRef.setInput('foto', '/fotos/def');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe(
      `${API_URL}/fotos/def`,
    );
  });

  it('mostra a pré-visualização local sem passar pela API', () => {
    const fixture = criar('data:image/jpeg;base64,/9j/AA==');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/jpeg;base64,/9j/AA==',
    );
  });
});
