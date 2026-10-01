import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { formatarDuracao, formatarKm, tempoRelativo } from '../../core/formato';
import { ESPECIES, PORTES } from '../../core/models';
import { PasseiosService } from '../../core/passeios.service';
import { Mapa, TrajetoMapa } from '../../shared/mapa/mapa';

@Component({
  selector: 'app-meu-perfil',
  imports: [ReactiveFormsModule, RouterLink, Mapa],
  templateUrl: './meu-perfil.html',
  styleUrl: './meu-perfil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeuPerfil {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly passeiosService = inject(PasseiosService);

  protected readonly perfil = this.auth.perfil;
  protected readonly meusPasseios = this.passeiosService.meus;
  protected readonly kmTotal = this.passeiosService.kmTotal;
  protected readonly totalPasseios = this.passeiosService.totalPasseios;
  protected readonly encontrosConfirmados = this.passeiosService.encontrosConfirmados;
  protected readonly portes = PORTES;

  protected readonly especie = computed(
    () => ESPECIES.find((e) => e.id === this.perfil()?.especie)?.label ?? '',
  );
  protected readonly porte = computed(
    () => PORTES.find((p) => p.id === this.perfil()?.porte)?.label ?? '',
  );

  /** Passeio escolhido na lista fica em destaque no mapa. */
  protected readonly selecionado = signal<number | null>(null);
  protected readonly trajetos = computed<TrajetoMapa[]>(() =>
    this.meusPasseios().map((p) => ({
      id: p.id,
      pontos: p.pontos,
      destaque: p.id === this.selecionado(),
    })),
  );

  protected readonly editando = signal(false);
  protected readonly salvando = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    pet: ['', Validators.required],
    raca: [''],
    idadeAnos: [0, [Validators.required, Validators.min(0), Validators.max(40)]],
    porte: this.perfil()?.porte ?? 'medio',
    bio: ['', Validators.maxLength(200)],
    metaSemanalKm: [15, [Validators.required, Validators.min(1), Validators.max(200)]],
  });

  private readonly formEvents = toSignal(this.form.events);

  protected readonly petErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.pet;
    return c.touched && c.invalid ? 'Informe o nome do pet.' : null;
  });

  protected readonly idadeErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.idadeAnos;
    return c.touched && c.invalid ? 'Informe uma idade entre 0 e 40 anos.' : null;
  });

  protected readonly metaErro = computed(() => {
    this.formEvents();
    const c = this.form.controls.metaSemanalKm;
    return c.touched && c.invalid ? 'A meta deve ficar entre 1 e 200 km.' : null;
  });

  protected readonly formatarKm = formatarKm;
  protected readonly formatarDuracao = formatarDuracao;
  protected readonly tempoRelativo = tempoRelativo;

  constructor() {
    this.passeiosService.carregar();
  }

  protected editar(): void {
    const perfil = this.perfil();
    if (!perfil) return;
    this.form.reset({
      pet: perfil.pet,
      raca: perfil.raca,
      idadeAnos: perfil.idadeAnos,
      porte: perfil.porte,
      bio: perfil.bio,
      metaSemanalKm: perfil.metaSemanalKm,
    });
    this.editando.set(true);
  }

  protected cancelar(): void {
    this.editando.set(false);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    try {
      await this.auth.atualizarPerfil(this.form.getRawValue());
      this.editando.set(false);
    } finally {
      this.salvando.set(false);
    }
  }

  protected selecionar(id: number): void {
    this.selecionado.update((atual) => (atual === id ? null : id));
  }

  protected async sair(): Promise<void> {
    this.auth.sair();
    await this.router.navigateByUrl('/login');
  }
}
