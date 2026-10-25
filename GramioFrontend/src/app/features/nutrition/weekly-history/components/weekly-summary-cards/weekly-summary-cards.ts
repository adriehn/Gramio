
import { Component, input } from '@angular/core';
import { WeeklyAverages } from '@core/models/weekly-summary.model';

@Component({
  selector: 'app-weekly-summary-cards',
  standalone: true,
  templateUrl: './weekly-summary-cards.html',
  styleUrl: './weekly-summary-cards.css',
})
export class WeeklySummaryCardsComponent {
  averages = input.required<WeeklyAverages>();
  registeredDays = input.required<number>();
  totalDays = input(7);

  format(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '—';

    return value.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  get calorieDifference(): number | null {
    const { kcal, targetKcal } = this.averages();

    if (kcal == null || targetKcal == null) return null;

    return Math.round(kcal - targetKcal);
  }

  get proteinDifference(): number | null {
    const { proteinG, targetProteinG } = this.averages();

    if (proteinG == null || targetProteinG == null) return null;

    return Math.round(proteinG - targetProteinG);
  }
}
