import { supabaseAdmin } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización ausente o inválido.',
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización ausente o inválido.',
      });
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada o no autorizada.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    return next();
  } catch (err) {
    console.error('[Auth Middleware]:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Error interno al autenticar la petición.',
    });
  }
}