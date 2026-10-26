
export type ObservedTdeeStatus =
  | 'available'
  | 'insufficient_data'
  | 'review_required';

export interface ObservedWeightTrend {
  available: boolean;
  reason?: string;
  measurementsCount?: number;
  firstDate?: string;
  lastDate?: string;
  firstWeightKg?: number;
  lastWeightKg?: number;
  observedChangeKg?: number;
  trendKgPerWeek?: number;
  slopeKgPerDay?: number;
  spanDays?: number;
}

export interface ObservedTdeePeriod {
  periodDays: 14 | 28;
  startDate: string;
  endDate: string;
  registeredDays: number;
  requiredRegisteredDays: number;
  averageIntakeKcal: number | null;
  weightTrend: ObservedWeightTrend;
  estimatedTdeeKcal: number | null;
  estimatedDailyEnergyBalanceKcal: number | null;
  status: ObservedTdeeStatus;
  warnings: string[];
}

export interface ObservedTdeeResponse {
  generatedAt: string;
  dataThrough: string;
  minimumRegisteredDays: number;
  results: ObservedTdeePeriod[];
}
