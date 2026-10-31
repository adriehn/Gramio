
import { Component, computed, input } from '@angular/core';
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

  // Todos los objetivos provienen de los registros históricos.
  readonly targetKcal = computed(() => this.averages().targetKcal);
  readonly targetProteinG = computed(() => this.averages().targetProteinG);
  readonly targetCarbsG = computed(() => this.averages().targetCarbsG);
  readonly targetFatG = computed(() => this.averages().targetFatG);
  readonly targetFiberG = computed(() => this.averages().targetFiberG);

  // Diferencias entre el promedio de consumo y el objetivo histórico.
  readonly calorieDifference = computed(() => {
    const average = this.averages().kcal;
    const target = this.targetKcal();

    if (average == null || target == null) return null;

    return average - target;
  });

  readonly proteinDifference = computed(() => {
    const average = this.averages().proteinG;
    const target = this.targetProteinG();

    if (average == null || target == null) return null;

    return average - target;
  });

  readonly carbsDifference = computed(() => {
    const average = this.averages().carbsG;
    const target = this.targetCarbsG();

    if (average == null || target == null) return null;

    return average - target;
  });

  readonly fatDifference = computed(() => {
    const average = this.averages().fatG;
    const target = this.targetFatG();

    if (average == null || target == null) return null;

    return average - target;
  });

  readonly fiberDifference = computed(() => {
    const average = this.averages().fiberG;
    const target = this.targetFiberG();

    if (average == null || target == null) return null;

    return average - target;
  });
}
