
import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.middleware.js';

import { calculateMetabolicTarget } from './nutrition.controller.js';
import { getWeeklySummary } from './weekly-summary.controller.js';
import { createCustomRecipe } from './recipe.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/calculate-target', calculateMetabolicTarget);
router.get('/weekly-summary', getWeeklySummary);
router.post('/recipes', createCustomRecipe);

export default router;
