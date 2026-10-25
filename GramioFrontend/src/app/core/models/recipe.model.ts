export type IngredientSource = 'database' | 'manual';

export interface ManualMacros {
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  fiber_100: number;
}

export interface RecipeIngredient {
  source: 'database' | 'manual';
  quantity_g: number;
  food_id?: string;
  manual_name?: string;
  manual_macros?: {
    kcal_100: number;
    protein_100: number;
    carbs_100: number;
    fat_100: number;
    fiber_100: number;
  };
}

export interface CreateRecipePayload {
  name: string;
  ingredients: RecipeIngredient[];
  is_cooked?: boolean;
  cooked_weight_g?: number | null;
}