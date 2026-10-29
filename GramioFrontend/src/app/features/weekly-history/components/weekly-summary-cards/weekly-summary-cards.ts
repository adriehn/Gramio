import { Component, computed, inject, input } from '@angular/core';
import { WeeklyAverages } from '@core/models/weekly-summary.model';
import { ProfileService } from '@core/services/profile.service';

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

  private readonly profileService = inject(ProfileService);

  constructor() {
    this.profileService.loadActiveTarget().subscribe();
  }

  format(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '—';

    return value.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // Objetivo de calorías real y reactivo
  readonly activeTargetKcal = computed(() => {
    const currentTarget = this.profileService.activeTarget();
    return currentTarget?.target_kcal ?? this.averages().targetKcal;
  });

  // Objetivo de proteínas real y reactivo
  readonly activeProteinG = computed(() => {
    const currentTarget = this.profileService.activeTarget();
    return currentTarget?.protein_g ?? this.averages().targetProteinG;
  });

  // Diferencia de calorías basada en el objetivo activo
  readonly calorieDifference = computed(() => {
    const kcal = this.averages().kcal;
    const target = this.activeTargetKcal();
    if (kcal == null || target == null) return null;
    return Math.round(kcal - target);
  });

  // Diferencia de proteínas basada en el objetivo activo
  readonly proteinDifference = computed(() => {
    const protein = this.averages().proteinG;
    const target = this.activeProteinG();
    if (protein == null || target == null) return null;
    return Math.round(protein - target);
  });
}