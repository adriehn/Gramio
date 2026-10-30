import { WeeklySummaryService } from './weekly-summary.service.js';

function isValidMonday(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  // Rechaza fechas inexistentes, por ejemplo 2026-02-30.
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false;
  }

  // UTC: domingo = 0, lunes = 1.
  return date.getUTCDay() === 1;
}

export async function getWeeklySummary(req, res, next) {
  const { startDate } = req.query;

  if (!isValidMonday(startDate)) {
    return res.status(400).json({
      success: false,
      message:
        'startDate es obligatorio y debe ser una fecha válida de lunes, en formato YYYY-MM-DD.',
    });
  }

  try {
    const data = await WeeklySummaryService.getWeek(
      req.user.id,
      startDate,
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}