export type Sex = 'male' | 'female';
export type BmrFormula = 'mifflin' | 'harris' | 'katch';
export type GoalType = 'maintain' | 'deficit' | 'surplus';
export type FatMode = 'per_kg' | 'pct_kcal' | 'fixed_g';
export type FiberMode = 'per_1000kcal' | 'fixed';

export interface MetabolicInput {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct?: number;
  activityFactor: number;
  formula: BmrFormula;
  goalType: GoalType;
  kcalAdjustment: number;
  proteinRatioPerKg: number;
  fatMode: FatMode;
  fatValue: number;
  fiberMode: FiberMode;
  fiberValue: number;
}

export interface CalculatedTarget {
  bmr: number;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

export interface MacroNutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}