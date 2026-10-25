import { BmrFormula, FatMode, FiberMode, GoalType, ProteinMode } from './nutrition.model';

export interface MetabolicTargetRecord {
  id?: string;
  user_id?: string;
  is_active: boolean;
  // Inputs
  weight_kg: number;
  body_fat_pct?: number | null;
  age_years: number;
  activity_factor: number;
  bmr_formula: BmrFormula;
  goal_type: GoalType;
  kcal_adjustment: number;
  protein_mode?: ProteinMode;   
  protein_value?: number;      
  protein_per_kg: number;       
  fat_mode: FatMode;
  fat_value: number;
  fiber_mode: FiberMode;
  fiber_value: number;
  // Outputs
  bmr_kcal: number;
  tdee_kcal: number;
  target_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  created_at?: string;
}