// food-diary.model.ts

export type MealType =
    | 'breakfast'
    | 'lunch'
    | 'snack'
    | 'dinner'
    | 'other';

export interface FoodItem {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    kcal_100: number;
    protein_100: number;
    carbs_100: number;
    fat_100: number;
    fiber_100: number;
    user_id?: string;
    is_custom?: boolean;
}

export interface DiarySession {
    id: string;
    user_id: string;
    started_at: string;
    expires_at: string;
    status: 'open' | 'closed' | 'expired';
}

export interface MealGroup {
    id: string;
    session_id: string;
    user_id: string;
    meal_type: MealType;
    label: string;
    group_order: number;
    status: 'open' | 'closed';
    created_at: string;
    closed_at: string | null;
}

export interface DiaryEntry {
    id: string;
    session_id: string | null;
    meal_group_id: string | null;
    food_id: string | null;
    name: string;
    quantity_g: number;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    log_date: string;
    created_at: string;
}

export interface FoodHistoryItem {
    name: string;
    category?: string;
    timesEaten: number;
    totalGrams: number;
}