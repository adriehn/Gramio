import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import {
  getMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement
} from './body-measurements.controller.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

router.get('/', getMeasurements);
router.post('/', createMeasurement);
router.put('/:id', updateMeasurement);
router.delete('/:id', deleteMeasurement);

export default router;