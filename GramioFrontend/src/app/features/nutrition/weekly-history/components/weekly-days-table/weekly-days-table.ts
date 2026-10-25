
import { Component, input } from '@angular/core';
import { WeeklySummaryDay } from '@core/models/weekly-summary.model';

@Component({
  selector: 'app-weekly-days-table',
  standalone: true,
  templateUrl: './weekly-days-table.html',
  styleUrl: './weekly-days-table.css',
})
export class WeeklyDaysTableComponent {
  days = input.required<WeeklySummaryDay[]>();

  format(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '—';

    return value.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  statusLabel(status: string | null): string {
    if (!status) return 'Sin datos';

    const normalized = status.toLowerCase();

    if (normalized.includes('adequate') || normalized.includes('adecuad')) {
      return 'Adecuada';
    }

    if (normalized.includes('low') || normalized.includes('bajo')) {
      return 'Baja';
    }

    if (normalized.includes('high') || normalized.includes('alto')) {
      return 'Alta';
    }

    return status;
  }
}
