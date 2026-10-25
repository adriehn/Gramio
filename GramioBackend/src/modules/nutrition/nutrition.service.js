
import { supabaseAdmin } from '../../lib/supabase.js';

export class NutritionService {
  static calculateBmr(input) {
    const {
      sex,
      age,
      weightKg: w,
      heightCm: h,
      bodyFatPct,
      formula
    } = input;

    switch (formula) {
      case 'mifflin':
        return Math.round(
          10 * w + 6.25 * h - 5 * age +
          (sex === 'male' ? 5 : -161)
        );

      case 'harris':
        return Math.round(
          sex === 'male'
            ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
            : 447.593 + 9.247 * w + 3.098 * h - 4.33 * age
        );

      case 'katch': {
        if (bodyFatPct === undefined || bodyFatPct === null) {
          throw new Error('missing_body_fat');
        }

        const leanMass = w * (1 - bodyFatPct / 100);
        return Math.round(370 + 21.6 * leanMass);
      }

      default:
        throw new Error('Fórmula BMR inválida');
    }
  }

  static computeTargetSplit(input) {
    const bmr = this.calculateBmr(input);
    const tdee = Math.round(bmr * input.activityFactor);
    const targetKcal = Math.max(1000, tdee + input.kcalAdjustment);

    const proteinG =
      Math.round(input.weightKg * input.proteinRatioPerKg * 10) / 10;

    const proteinKcal = proteinG * 4;

    let fatG = 0;

    if (input.fatMode === 'per_kg') {
      fatG = input.weightKg * input.fatValue;
    } else if (input.fatMode === 'pct_kcal') {
      fatG = (targetKcal * (input.fatValue / 100)) / 9;
    } else {
      fatG = input.fatValue;
    }

    fatG = Math.round(fatG * 10) / 10;

    const fatKcal = fatG * 9;
    const remainingKcal = targetKcal - (proteinKcal + fatKcal);

    if (remainingKcal < 0) {
      throw new Error('negative_carbs');
    }

    const carbsG = Math.round((remainingKcal / 4) * 10) / 10;

    let fiberG = 0;

    if (input.fiberMode === 'per_1000kcal') {
      fiberG =
        Math.round((targetKcal / 1000) * input.fiberValue * 10) / 10;
    } else {
      fiberG = input.fiberValue;
    }

    return {
      bmr,
      tdee,
      targetKcal,
      proteinG,
      fatG,
      carbsG,
      fiberG
    };
  }

  static async createCustomRecipe(userId, recipePayload) {
    if (!userId) throw new Error('Usuario no autenticado');

    const { name, ingredients, is_cooked } = recipePayload;

    let totalWeight = 0, totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;

    const dbIngredientIds = ingredients.filter(i => i.source === 'database').map(i => i.food_id);
    const dbFoodsMap = new Map();

    if (dbIngredientIds.length > 0) {
      const { data: dbFoods } = await supabaseAdmin
        .from('foods')
        .select('id, kcal_100, protein_100, carbs_100, fat_100, fiber_100')
        .in('id', dbIngredientIds);

      if (dbFoods) dbFoods.forEach(f => dbFoodsMap.set(f.id, f));
    }

    ingredients.forEach(ing => {
      const q = ing.quantity_g || 0;
      totalWeight += q;
      const factor = q / 100;

      if (ing.source === 'database') {
        const food = dbFoodsMap.get(ing.food_id);
        if (food) {
          totalKcal += (food.kcal_100 || 0) * factor;
          totalProtein += (food.protein_100 || 0) * factor;
          totalCarbs += (food.carbs_100 || 0) * factor;
          totalFat += (food.fat_100 || 0) * factor;
          totalFiber += (food.fiber_100 || 0) * factor;
        }
      } else if (ing.source === 'manual' && ing.manual_macros) {
        totalKcal += ing.manual_macros.kcal_100 * factor;
        totalProtein += ing.manual_macros.protein_100 * factor;
        totalCarbs += ing.manual_macros.carbs_100 * factor;
        totalFat += ing.manual_macros.fat_100 * factor;
        totalFiber += ing.manual_macros.fiber_100 * factor;
      }
    });

    if (totalWeight <= 0) throw new Error('El peso total no puede ser cero.');

    // Cálculo del rendimiento (yield) y la concentración por evaporación
    const finalYieldG = is_cooked ? totalWeight * 0.90 : totalWeight;
    const evaporationMultiplier = is_cooked ? 1.10 : 1.0;
    const to100g = (val) => Math.round((val / totalWeight) * 100 * evaporationMultiplier * 10) / 10;

    const kcal_100 = to100g(totalKcal);
    const protein_100 = to100g(totalProtein);
    const carbs_100 = to100g(totalCarbs);
    const fat_100 = to100g(totalFat);
    const fiber_100 = to100g(totalFiber);

    // 1. Insertar en foods
    const { data: foodData, error: foodError } = await supabaseAdmin
      .from('foods')
      .insert({
        user_id: userId,
        name: name.trim(),
        category: 'recipe',
        kcal_100, protein_100, carbs_100, fat_100, fiber_100,
        is_archived: false
      }).select('id').single();

    if (foodError) throw new Error(`Error insertando alimento: ${foodError.message}`);

    // 2. Insertar en recipes incluyendo yield_g
    const { data: recipeData, error: recipeError } = await supabaseAdmin
      .from('recipes')
      .insert({
        user_id: userId,
        food_id: foodData.id,
        name: name.trim(),
        yield_g: Math.round(finalYieldG) // Solución al constraint not-null
      })
      .select('id').single();

    if (recipeError) throw new Error(`Error insertando receta: ${recipeError.message}`);

// 3. Insertar en recipe_ingredients
    const recipeIngredientsRows = ingredients.map(ing => {
      const isManual = ing.source === 'manual';
      
      return {
        recipe_id: recipeData.id,
        source: ing.source,
        quantity_g: ing.quantity_g,
        food_id: isManual ? null : ing.food_id,
        manual_name: isManual ? (ing.manual_name || ing.name || 'Ingrediente manual').trim() : null,
        
        // La restricción exige estas columnas exactas para manuales (y null para base de datos)
        kcal_100: isManual ? (ing.manual_macros?.kcal_100 || 0) : null,
        protein_100: isManual ? (ing.manual_macros?.protein_100 || 0) : null,
        carbs_100: isManual ? (ing.manual_macros?.carbs_100 || 0) : null,
        fat_100: isManual ? (ing.manual_macros?.fat_100 || 0) : null,
        fiber_100: isManual ? (ing.manual_macros?.fiber_100 || 0) : null
      };
    });

    const { error: ingError } = await supabaseAdmin
      .from('recipe_ingredients')
      .insert(recipeIngredientsRows);

    if (ingError) throw new Error(`Error insertando ingredientes: ${ingError.message}`);

    return { 
      food_id: foodData.id, 
      recipe_id: recipeData.id, 
      name: name.trim(), 
      kcal_100, 
      protein_100, 
      carbs_100, 
      fat_100, 
      fiber_100 
    };
  }
}