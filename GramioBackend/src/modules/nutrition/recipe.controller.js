
import { createRecipeSchema } from './nutrition.recipe.schema.js';
import { NutritionService } from './nutrition.service.js';

export const createCustomRecipe = async (req, res, next) => {
  const validation = createRecipeSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: 'Los datos de la receta no son válidos.',
      errors: validation.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  try {
    const recipe = await NutritionService.createCustomRecipe(
      req.user.id,
      validation.data
    );

    return res.status(201).json({
      success: true,
      message: 'Receta creada correctamente.',
      data: recipe
    });
  } catch (error) {
    return next(error);
  }
};
