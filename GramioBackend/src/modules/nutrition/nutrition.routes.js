import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';

import { calculateMetabolicTarget } from './nutrition.controller.js';
import { getWeeklySummary } from './weekly-summary.controller.js';
import { getObservedTdee } from './observed-tdee.controller.js';
import { createCustomRecipe, deleteCustomRecipe, getCustomRecipe, updateCustomRecipe } from './recipe.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/calculate-target', calculateMetabolicTarget);
router.get('/weekly-summary', getWeeklySummary);
router.get('/observed-tdee', getObservedTdee);

// Rutas de Recetas Propias
router.post('/recipes', createCustomRecipe);
router.get('/recipes/:id', getCustomRecipe); 
router.put('/recipes/:id', updateCustomRecipe); 
router.delete('/recipes/:id', deleteCustomRecipe);

export default router;