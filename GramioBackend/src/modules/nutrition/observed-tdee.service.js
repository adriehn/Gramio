import { supabaseAdmin } from '../../lib/supabase.js';

const PERIODS = [14, 28];

const MIN_REGISTERED_DAYS = 14;
const MIN_WEIGHT_MEASUREMENTS = 3;
const MIN_WEIGHT_COVERAGE = 0.7;
const MIN_WEIGHT_SPAN_DAYS = 7;

const KCAL_PER_KG = 7700;

const TDEE_DIFFERENCE_KCAL = 300;
const TDEE_DIFFERENCE_PERCENT = 10;

function getArgentinaToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, amount) {
    const date = new Date(`${dateString}T12:00:00Z`);

    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function round(value, decimals = 0) {
    const factor = 10 ** decimals;

    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
    if (!values.length) {
        return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addWarning(result, message) {
    if (!result.warnings.includes(message)) {
        result.warnings.push(message);
    }
}

function requireReview(result, message) {
    addWarning(result, message);

    if (result.status === 'available') {
        result.status = 'review_required';
    }
}

/**
 * Calcula la pendiente del peso en kg/día mediante regresión lineal.
 */
function calculateWeightTrend(measurements) {
    const points = measurements
        .filter((item) => {
            const weight = Number(item.weight_kg);

            return (
                item.measured_on &&
                item.weight_kg !== null &&
                item.weight_kg !== undefined &&
                Number.isFinite(weight) &&
                weight > 0
            );
        })
        .map((item) => ({
            date: item.measured_on,
            weight: Number(item.weight_kg),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 2) {
        return {
            available: false,
            measurementsCount: points.length,
            reason: 'Necesitás al menos dos mediciones de peso válidas.',
        };
    }

    const origin = new Date(`${points[0].date}T12:00:00Z`).getTime();

    for (const point of points) {
        point.day = Math.round(
            (
                new Date(`${point.date}T12:00:00Z`).getTime() -
                origin
            ) / 86_400_000
        );
    }

    const first = points[0];
    const last = points[points.length - 1];

    const spanDays = last.day - first.day;

    if (spanDays < MIN_WEIGHT_SPAN_DAYS) {
        return {
            available: false,
            measurementsCount: points.length,
            firstDate: first.date,
            lastDate: last.date,
            firstWeightKg: first.weight,
            lastWeightKg: last.weight,
            spanDays,
            reason: `Las mediciones de peso deben abarcar al menos ${MIN_WEIGHT_SPAN_DAYS} días.`,
        };
    }

    const meanDay = mean(points.map((point) => point.day));
    const meanWeight = mean(points.map((point) => point.weight));

    const numerator = points.reduce(
        (sum, point) =>
            sum +
            (point.day - meanDay) * (point.weight - meanWeight),
        0
    );

    const denominator = points.reduce(
        (sum, point) => sum + (point.day - meanDay) ** 2,
        0
    );

    if (denominator === 0) {
        return {
            available: false,
            measurementsCount: points.length,
            reason: 'No se pudo calcular una tendencia de peso.',
        };
    }

    const slopeKgPerDay = numerator / denominator;

    return {
        available: true,
        measurementsCount: points.length,
        firstDate: first.date,
        lastDate: last.date,
        firstWeightKg: first.weight,
        lastWeightKg: last.weight,
        observedChangeKg: round(last.weight - first.weight, 2),
        trendKgPerWeek: round(slopeKgPerDay * 7, 2),
        slopeKgPerDay,
        spanDays,
    };
}

function calculatePeriodResult(
    days,
    measurements,
    periodDays,
    endDate
) {
    const startDate = addDays(endDate, -(periodDays - 1));

    const registeredDays = days.filter((day) => {
        const kcal = Number(day.kcal);
        const entriesCount = Number(day.entries_count);

        return (
            Number.isFinite(kcal) &&
            kcal >= 0 &&
            Number.isFinite(entriesCount) &&
            entriesCount > 0
        );
    });

    const averageIntakeKcal = mean(
        registeredDays.map((day) => Number(day.kcal))
    );

    const weightTrend = calculateWeightTrend(measurements);

    const result = {
        periodDays,
        startDate,
        endDate,
        registeredDays: registeredDays.length,
        requiredRegisteredDays: MIN_REGISTERED_DAYS,
        averageIntakeKcal:
            averageIntakeKcal === null
                ? null
                : round(averageIntakeKcal),
        weightTrend,
        estimatedTdeeKcal: null,
        estimatedDailyEnergyBalanceKcal: null,
        status: 'insufficient_data',
        warnings: [],
    };

    if (registeredDays.length < MIN_REGISTERED_DAYS) {
        addWarning(
            result,
            `Se necesitan al menos ${MIN_REGISTERED_DAYS} días con ingesta registrada.`
        );
    }

    if (!weightTrend.available) {
        addWarning(
            result,
            weightTrend.reason ??
                'No hay mediciones suficientes para calcular la tendencia.'
        );
    }

    if (
        registeredDays.length < MIN_REGISTERED_DAYS ||
        !weightTrend.available
    ) {
        return result;
    }

    /*
     * TDEE estimado = ingesta media - pendiente de peso (kg/día) * 7700.
     * Es una aproximación energética, no una medición directa del gasto.
     */
    const estimatedTdee =
        averageIntakeKcal -
        weightTrend.slopeKgPerDay * KCAL_PER_KG;

    if (!Number.isFinite(estimatedTdee) || estimatedTdee <= 0) {
        addWarning(
            result,
            'Los datos no permiten obtener una estimación energética válida.'
        );

        return result;
    }

    result.estimatedTdeeKcal = round(estimatedTdee);

    result.estimatedDailyEnergyBalanceKcal = round(
        averageIntakeKcal - estimatedTdee
    );

    result.status = 'available';

    if (estimatedTdee < 1000 || estimatedTdee > 7000) {
        requireReview(
            result,
            'El resultado está fuera del rango habitual esperado. Revisá los registros antes de usarlo.'
        );
    }

    if (weightTrend.measurementsCount < MIN_WEIGHT_MEASUREMENTS) {
        requireReview(
            result,
            `Hay ${weightTrend.measurementsCount} mediciones de peso. Se recomiendan al menos ${MIN_WEIGHT_MEASUREMENTS} para evaluar la estimación con mayor confianza.`
        );
    }

    const coverage = weightTrend.spanDays / (periodDays - 1);

    if (coverage < MIN_WEIGHT_COVERAGE) {
        requireReview(
            result,
            `Los pesajes cubren ${weightTrend.spanDays} días de un período de ${periodDays}. Se necesita una cobertura temporal de al menos el ${Math.round(MIN_WEIGHT_COVERAGE * 100)} % para considerar la estimación con mayor confianza.`
        );
    }

    if (registeredDays.length < periodDays) {
        addWarning(
            result,
            `Hay ${periodDays - registeredDays.length} días sin ingesta válida en el período.`
        );
    }

    addWarning(
        result,
        'Estimación orientativa: las variaciones de agua, glucógeno y contenido intestinal pueden afectar la tendencia de peso.'
    );

    return result;
}

/**
 * Compara las estimaciones de 14 y 28 días.
 */
function comparePeriodResults(results) {
    const shortPeriod = results.find(
        (result) => result.periodDays === 14
    );

    const longPeriod = results.find(
        (result) => result.periodDays === 28
    );

    if (
        !shortPeriod ||
        !longPeriod ||
        shortPeriod.estimatedTdeeKcal === null ||
        longPeriod.estimatedTdeeKcal === null
    ) {
        return;
    }

    const difference = Math.abs(
        shortPeriod.estimatedTdeeKcal -
        longPeriod.estimatedTdeeKcal
    );

    const averageTdee = mean([
        shortPeriod.estimatedTdeeKcal,
        longPeriod.estimatedTdeeKcal,
    ]);

    if (averageTdee === null || averageTdee <= 0) {
        return;
    }

    const differencePercent = (difference / averageTdee) * 100;

    if (
        difference >= TDEE_DIFFERENCE_KCAL &&
        differencePercent >= TDEE_DIFFERENCE_PERCENT
    ) {
        const message =
            `Las estimaciones de 14 y 28 días difieren en ${round(difference)} kcal/día (${round(differencePercent, 1)} %). Revisá la consistencia de los registros antes de considerar un ajuste energético.`;

        requireReview(shortPeriod, message);
        requireReview(longPeriod, message);
    }
}

export class ObservedTdeeService {
    static async estimate(userId) {
        const endDate = addDays(getArgentinaToday(), -1);
        const longestStartDate = addDays(endDate, -27);

        const [summariesResponse, measurementsResponse] =
            await Promise.all([
                supabaseAdmin
                    .from('daily_summaries')
                    .select('summary_date,kcal,entries_count')
                    .eq('user_id', userId)
                    .gte('summary_date', longestStartDate)
                    .lte('summary_date', endDate)
                    .order('summary_date', { ascending: true }),

                supabaseAdmin
                    .from('body_measurements')
                    .select('measured_on,weight_kg')
                    .eq('user_id', userId)
                    .gte('measured_on', longestStartDate)
                    .lte('measured_on', endDate)
                    .not('weight_kg', 'is', null)
                    .order('measured_on', { ascending: true }),
            ]);

        if (summariesResponse.error) {
            throw summariesResponse.error;
        }

        if (measurementsResponse.error) {
            throw measurementsResponse.error;
        }

        const summaries = summariesResponse.data ?? [];
        const measurements = measurementsResponse.data ?? [];

        const results = PERIODS.map((periodDays) => {
            const startDate = addDays(
                endDate,
                -(periodDays - 1)
            );

            const periodSummaries = summaries.filter(
                (summary) =>
                    summary.summary_date >= startDate &&
                    summary.summary_date <= endDate
            );

            const periodMeasurements = measurements.filter(
                (measurement) =>
                    measurement.measured_on >= startDate &&
                    measurement.measured_on <= endDate
            );

            return calculatePeriodResult(
                periodSummaries,
                periodMeasurements,
                periodDays,
                endDate
            );
        });

        comparePeriodResults(results);

        return {
            generatedAt: new Date().toISOString(),
            dataThrough: endDate,
            minimumRegisteredDays: MIN_REGISTERED_DAYS,
            results,
        };
    }
}