import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { calculateMetabolicTarget } from './nutrition.controller.js';
import { getWeeklySummary } from './weekly-summary.controller.js';

const router = Router();

// Todas estas rutas requieren autenticación.
router.use(requireAuth);

router.post('/calculate-target', calculateMetabolicTarget);

router.get('/weekly-summary', getWeeklySummary);

export default router;