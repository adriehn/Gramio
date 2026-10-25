
export interface WeeklySummaryDay {
  date: string;
  dayName: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  proteinStatus: string | null;
  trainingNotes: string | null;
  entriesCount: number;
  hasNutritionData: boolean;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetFiberG: number | null;
  tdeeKcal: number | null;
}

export interface WeeklyAverages {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  targetKcal: number | null;
  targetProteinG: number | null;
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
  };
}
