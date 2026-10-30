
import { supabaseAdmin } from '../../config/supabase.js';

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

  //Eliminar receta personalizada
  static async deleteCustomRecipe(userId, foodId) {
    if (!userId) throw new Error('Usuario no autenticado');

    // 1. Verificar que el alimento existe y pertenece al usuario
    const { data: food, error: findError } = await supabaseAdmin
      .from('foods')
      .select('id')
      .eq('id', foodId)
      .eq('user_id', userId)
      .single();

    if (findError || !food) {
      throw new Error('Alimento no encontrado o no tienes permiso para eliminarlo.');
    }

    // 2. Buscar si tiene una receta asociada en la tabla 'recipes'
    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id')
      .eq('food_id', foodId)
      .maybeSingle();

    if (recipe) {
      // 3. Eliminar los ingredientes primero (hijos)
      const { error: ingError } = await supabaseAdmin
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipe.id);

      if (ingError) throw new Error(`Error borrando ingredientes: ${ingError.message}`);

      // 4. Eliminar la receta (podemos hacer borrado físico aquí sin problema)
      const { error: recError } = await supabaseAdmin
        .from('recipes')
        .delete()
        .eq('id', recipe.id);

      if (recError) throw new Error(`Error borrando receta: ${recError.message}`);
    }

    // 5. SOFT DELETE: En lugar de .delete(), archivamos el alimento en 'foods'.
    // Esto evita el error 500 si la receta ya fue registrada en daily_logs.
    const { error: delError } = await supabaseAdmin
      .from('foods')
      .update({ is_archived: true })
      .eq('id', foodId);

    if (delError) throw new Error(`Error archivando el alimento: ${delError.message}`);

    return true;
  }

  // Obtener datos crudos de la receta para el Modal de Edición
  static async getCustomRecipe(userId, foodId) {
    // 1. Verificar alimento
    const { data: food, error: foodErr } = await supabaseAdmin
      .from('foods')
      .select('id, name')
      .eq('id', foodId)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .single();

    if (foodErr || !food) throw new Error('Receta no encontrada o fue eliminada.');

    // 2. Verificar datos de receta
    const { data: recipe, error: recErr } = await supabaseAdmin
      .from('recipes')
      .select('id, yield_g')
      .eq('food_id', foodId)
      .single();

    if (recErr || !recipe) throw new Error('Detalles de la receta no encontrados.');

    // 3. Obtener ingredientes y unir (join) con el nombre de la tabla foods
    const { data: ingredients, error: ingErr } = await supabaseAdmin
      .from('recipe_ingredients')
      .select(`
        *,
        food:foods(name, kcal_100, protein_100, carbs_100, fat_100, fiber_100)
      `)
      .eq('recipe_id', recipe.id);

    if (ingErr) throw new Error('Error al cargar los ingredientes.');

    // 4. Deducir si estaba marcada como cocinada (peso final menor al inicial)
    const totalQuantity = ingredients.reduce((sum, ing) => sum + Number(ing.quantity_g), 0);
    const is_cooked = recipe.yield_g < totalQuantity;

    // 5. Mapear al formato exacto que espera tu modal frontend
    const mappedIngredients = ingredients.map(ing => {
      const isDb = ing.source === 'database';

      const baseMacros = isDb && ing.food ? {
        kcal_100: ing.food.kcal_100,
        protein_100: ing.food.protein_100,
        carbs_100: ing.food.carbs_100,
        fat_100: ing.food.fat_100,
        fiber_100: ing.food.fiber_100
      } : {
        kcal_100: ing.kcal_100,
        protein_100: ing.protein_100,
        carbs_100: ing.carbs_100,
        fat_100: ing.fat_100,
        fiber_100: ing.fiber_100
      };

      return {
        source: ing.source,
        quantity_g: Number(ing.quantity_g),
        food_id: ing.food_id,
        name: isDb && ing.food ? ing.food.name : ing.manual_name,
        macros: baseMacros,
        manual_macros: !isDb ? baseMacros : undefined
      };
    });

    return {
      food_id: food.id,
      name: food.name,
      is_cooked,
      ingredients: mappedIngredients
    };
  }

  // Actualizar receta existente
  static async updateCustomRecipe(userId, foodId, recipePayload) {
    if (!userId) throw new Error('Usuario no autenticado');

    const { data: food } = await supabaseAdmin.from('foods').select('id').eq('id', foodId).eq('user_id', userId).single();
    if (!food) throw new Error('Receta no encontrada o no tienes permisos.');
    const { data: recipe } = await supabaseAdmin.from('recipes').select('id').eq('food_id', foodId).single();
    if (!recipe) throw new Error('Detalles de receta no encontrados.');

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

    // Cálculo de macros idéntico a la creación
    ingredients.forEach(ing => {
      const q = ing.quantity_g || 0;
      totalWeight += q;
      const factor = q / 100;

      if (ing.source === 'database') {
        const f = dbFoodsMap.get(ing.food_id);
        if (f) {
          totalKcal += (f.kcal_100 || 0) * factor;
          totalProtein += (f.protein_100 || 0) * factor;
          totalCarbs += (f.carbs_100 || 0) * factor;
          totalFat += (f.fat_100 || 0) * factor;
          totalFiber += (f.fiber_100 || 0) * factor;
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

    const finalYieldG = is_cooked ? totalWeight * 0.90 : totalWeight;
    const evaporationMultiplier = is_cooked ? 1.10 : 1.0;
    const to100g = (val) => Math.round((val / totalWeight) * 100 * evaporationMultiplier * 10) / 10;

    const kcal_100 = to100g(totalKcal);
    const protein_100 = to100g(totalProtein);
    const carbs_100 = to100g(totalCarbs);
    const fat_100 = to100g(totalFat);
    const fiber_100 = to100g(totalFiber);

    // 1. Actualizar tabla foods
    const { error: foodError } = await supabaseAdmin
      .from('foods')
      .update({ name: name.trim(), kcal_100, protein_100, carbs_100, fat_100, fiber_100 })
      .eq('id', foodId);

    if (foodError) throw new Error(`Error actualizando alimento: ${foodError.message}`);

    // 2. Actualizar tabla recipes
    const { error: recipeError } = await supabaseAdmin
      .from('recipes')
      .update({ name: name.trim(), yield_g: Math.round(finalYieldG) })
      .eq('id', recipe.id);

    if (recipeError) throw new Error(`Error actualizando receta: ${recipeError.message}`);

    // 3. Borrar ingredientes viejos e insertar los nuevos
    await supabaseAdmin.from('recipe_ingredients').delete().eq('recipe_id', recipe.id);

    const recipeIngredientsRows = ingredients.map(ing => {
      const isManual = ing.source === 'manual';
      return {
        recipe_id: recipe.id,
        source: ing.source,
        quantity_g: ing.quantity_g,
        food_id: isManual ? null : ing.food_id,
        manual_name: isManual ? (ing.manual_name || ing.name || 'Ingrediente manual').trim() : null,
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

    if (ingError) {
      if (ingError.code === '23505') {
        throw new Error('No podés repetir exactamente el mismo alimento dos veces en la misma receta. Sumá las cantidades en una sola línea.');
      }
      throw new Error(`Error insertando ingredientes: ${ingError.message}`);
    }

    return {
      food_id: foodId,
      recipe_id: recipe.id,
      name: name.trim(),
      kcal_100, protein_100, carbs_100, fat_100, fiber_100
    };
  }
}