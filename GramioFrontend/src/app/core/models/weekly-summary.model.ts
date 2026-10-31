
export interface WeeklySummaryDay {
  date: string;
  dayName?: string;

  // Consumo real
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;

  // Objetivos históricos
  tdeeKcal: number | null;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetFiberG: number | null;

  proteinStatus: string | null;
  trainingNotes: string;
  entriesCount: number;

  hasSummary: boolean;
  hasNutritionData: boolean;
}

export interface WeeklyAverages {
  // Promedios de consumo
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;

  // Promedios de objetivos
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetFiberG: number | null;
  tdeeKcal: number | null;
}

export interface WeeklySummaryResponse {
  startDate: string;
  endDate: string;
  days: WeeklySummaryDay[];
  averages: WeeklyAverages;
  progress: {
    registeredDays: number;
    totalDays: number;
    isComplete: boolean;
  };
}
