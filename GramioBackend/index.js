
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import nutritionRoutes from './src/modules/nutrition/nutrition.routes.js';
import authRoutes from './src/modules/auth/auth.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Cabeceras de seguridad
app.use(helmet());

// 2. Configuración de CORS
const allowedOrigins = [
    'http://localhost:4200',
    'https://gramio-frontend.vercel.app',
];
app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            const error = new Error(
                'Origen bloqueado por la política CORS'
            );

            error.statusCode = 403;
            return callback(error);
        },
        credentials: true,
    })
);

// 3. Límite de peticiones
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Demasiadas peticiones. Intentá nuevamente más tarde.',
    },
});

app.use('/api/', limiter);

// 4. Parseo de JSON
app.use(express.json({ limit: '10kb' }));

// 5. Rutas
app.use('/api/auth', authRoutes);
app.use('/api/nutrition', nutritionRoutes);

// 6. Endpoint de salud
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
    });
});

// 7. Ruta para endpoints inexistentes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
    });
});

// 8. Manejo centralizado de errores
app.use((err, req, res, next) => {
    console.error('[Error Global]:', err.message);

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? 'Error interno del servidor'
                : err.message,
        code:
            statusCode === 403
                ? 'CORS_ERROR'
                : 'INTERNAL_SERVER_ERROR',
    });
});

// 9. Inicio del servidor
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(
            `Gramio Backend ejecutándose en el puerto ${PORT}`
        );
    });
}

export default app;
