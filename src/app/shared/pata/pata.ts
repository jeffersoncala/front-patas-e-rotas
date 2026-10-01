import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Ícone de patinha da marca. Herda a cor do texto (`currentColor`). */
@Component({
  selector: 'svg[appPata]',
  template: `
    <svg:ellipse cx="7" cy="8.5" rx="2.4" ry="3.1" />
    <svg:ellipse cx="12" cy="6.4" rx="2.4" ry="3.2" />
    <svg:ellipse cx="17" cy="8.5" rx="2.4" ry="3.1" />
    <svg:path
      d="M12 11c3.3 0 6 2.3 6 5.1 0 2.2-1.8 3.9-4 3.9-1 0-1.5-.3-2-.3s-1 .3-2 .3c-2.2 0-4-1.7-4-3.9C6 13.3 8.7 11 12 11Z"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
})
export class Pata {}
