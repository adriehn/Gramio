
import { supabaseAdmin } from '../../config/supabase.js';

const DAY_COUNT = 7;

function addDays(dateString, amount) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function round(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

// Calcula promedios ignorando valores null y undefined.
function average(rows, field) {
    const validValues = rows
        .map((row) => row[field])
        .filter((value) => value !== null && value !== undefined)
        .map(Number)
        .filter(Number.isFinite);

    if (validValues.length === 0) {
        return null;
    }

    const total = validValues.reduce(
        (sum, value) => sum + value,
        0,
    );

    return round(total / validValues.length);
}

export class WeeklySummaryService {
    static async getWeek(userId, startDate) {
        const endDate = addDays(startDate, DAY_COUNT - 1);

        const { data, error } = await supabaseAdmin
            .from('daily_summaries')
            .select(`
                summary_date,
                kcal,
                protein_g,
                carbs_g,
                fat_g,
                fiber_g,
                entries_count,
                tdee_kcal,
                target_kcal,
                target_protein_g,
                target_carbs_g,
                target_fat_g,
                target_fiber_g,
                protein_status,
                training_notes
            `)
            .eq('user_id', userId)
            .gte('summary_date', startDate)
            .lte('summary_date', endDate)
            .order('summary_date', { ascending: true });

        if (error) {
            throw error;
        }

        const summariesByDate = new Map(
            (data ?? []).map((row) => [row.summary_date, row]),
        );

        const days = Array.from({ length: DAY_COUNT }, (_, index) => {
            const date = addDays(startDate, index);
            const summary = summariesByDate.get(date) ?? null;

            const entriesCount = Number(summary?.entries_count ?? 0);
            const hasNutritionData = Boolean(summary);

            return {
                date,
                hasSummary: Boolean(summary),
                hasNutritionData,
                entriesCount,

                // Consumo real
                kcal: summary ? Number(summary.kcal) : null,
                proteinG: summary ? Number(summary.protein_g) : null,
                carbsG: summary ? Number(summary.carbs_g) : null,
                fatG: summary ? Number(summary.fat_g) : null,
                fiberG: summary ? Number(summary.fiber_g) : null,

                // Objetivos históricos
                tdeeKcal: summary ? Number(summary.tdee_kcal) : null,
                targetKcal: summary ? Number(summary.target_kcal) : null,
                targetProteinG: summary
                    ? Number(summary.target_protein_g)
                    : null,
                targetCarbsG: summary?.target_carbs_g != null
                    ? Number(summary.target_carbs_g)
                    : null,
                targetFatG: summary?.target_fat_g != null
                    ? Number(summary.target_fat_g)
                    : null,
                targetFiberG: summary
                    ? Number(summary.target_fiber_g)
                    : null,

                proteinStatus: summary?.protein_status ?? null,
                trainingNotes: summary?.training_notes ?? '',
            };
        });

        // Solo los días con resúmenes participan en los promedios.
        const registeredDays = days.filter(
            (day) => day.hasNutritionData,
        );

        const averages = {
            // Consumo promedio
            kcal: average(registeredDays, 'kcal'),
            proteinG: average(registeredDays, 'proteinG'),
            carbsG: average(registeredDays, 'carbsG'),
            fatG: average(registeredDays, 'fatG'),
            fiberG: average(registeredDays, 'fiberG'),

            // Objetivos metabólicos históricos promedio
            targetKcal: average(registeredDays, 'targetKcal'),
            targetProteinG: average(registeredDays, 'targetProteinG'),
            targetCarbsG: average(registeredDays, 'targetCarbsG'),
            targetFatG: average(registeredDays, 'targetFatG'),
            targetFiberG: average(registeredDays, 'targetFiberG'),
            tdeeKcal: average(registeredDays, 'tdeeKcal'),
        };

        return {
            startDate,
            endDate,
            days,
            averages,
            progress: {
                totalDays: DAY_COUNT,
                registeredDays: registeredDays.length,
                isComplete: registeredDays.length === DAY_COUNT,
            },
        };
    }
}
