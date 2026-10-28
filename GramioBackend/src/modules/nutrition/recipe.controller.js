
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
// Eliminar receta personalizada
export const deleteCustomRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de receta requerido.' });
    }

    await NutritionService.deleteCustomRecipe(req.user.id, id);

    return res.status(200).json({
      success: true,
      message: 'Receta eliminada correctamente.'
    });
  } catch (error) {
    return next(error);
  }
};


// Obtener los detalles de una receta para editarla
export const getCustomRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de receta requerido.' });
    }

    const recipe = await NutritionService.getCustomRecipe(req.user.id, id);

    return res.status(200).json({
      success: true,
      data: recipe
    });
  } catch (error) {
    return next(error);
  }
};

// Actualizar receta propia
export const updateCustomRecipe = async (req, res, next) => {
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
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID de receta requerido.' });
    }

    const recipe = await NutritionService.updateCustomRecipe(
      req.user.id,
      id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: 'Receta actualizada correctamente.',
      data: recipe
    });
  } catch (error) {
    return next(error);
  }
};