import { Router } from 'express';
import { loginUser } from './auth.controller.js';

const router = Router();

// Ruta pública: POST /api/auth/login
router.post('/login', loginUser);

export default router;