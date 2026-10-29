import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ObservedTdeeService } from '../../core/services/observed-tdee.service';
import {
  ObservedTdeePeriod,
  ObservedTdeeResponse
} from '../../core/models/observed-tdee.model';

@Component({
  selector: 'app-observed-tdee',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './observed-tdee.html',
  styleUrl: './observed-tdee.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObservedTdeeComponent {
  private readonly service = inject(ObservedTdeeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly data = signal<ObservedTdeeResponse | null>(null);
  readonly selectedPeriod = signal<14 | 28>(28);

  readonly selectedResult = () => {
    const response = this.data();

    return response?.results.find(
      result => result.periodDays === this.selectedPeriod()
    ) ?? null;
  };

  constructor() {
    this.loadEstimate();
  }

  loadEstimate(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.service.getEstimate().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: response => this.data.set(response),
      error: error => this.errorMessage.set(this.getErrorMessage(error))
    });
  }

  selectPeriod(period: 14 | 28): void {
    this.selectedPeriod.set(period);
  }

  formatKcal(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';

    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 0
    }).format(value);
  }

  formatWeight(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';

    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatDate(value: string | undefined): string {
    if (!value) return '—';

    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;

    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  statusLabel(result: ObservedTdeePeriod): string {
    switch (result.status) {
      case 'available':
        return 'Estimación disponible';
      case 'review_required':
        return 'Revisar resultado';
      default:
        return 'Datos insuficientes';
    }
  }

  statusClass(result: ObservedTdeePeriod): string {
    switch (result.status) {
      case 'available':
        return 'status-available';
      case 'review_required':
        return 'status-review';
      default:
        return 'status-insufficient';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Tu sesión no es válida o venció. Iniciá sesión nuevamente.';
      }

      if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Revisá tu conexión y la URL del backend.';
      }

      if (error.status >= 500) {
        return 'El servidor tuvo un problema al calcular la estimación. Intentá nuevamente.';
      }

      return error.error?.message ?? 'No se pudo obtener la estimación.';
    }

    return 'Ocurrió un error inesperado al cargar los datos.';
  }
}