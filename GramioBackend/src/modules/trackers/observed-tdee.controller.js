
import { ObservedTdeeService } from './observed-tdee.service.js';

export async function getObservedTdee(req, res, next) {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Sesión no válida.',
            });
        }

        const data = await ObservedTdeeService.estimate(userId);

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }
}
