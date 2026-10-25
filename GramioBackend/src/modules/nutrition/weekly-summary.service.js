import { supabaseAdmin } from '../../lib/supabase.js';

const DAY_COUNT = 7;

const NUTRIENT_FIELDS = [
    'kcal',
    'protein_g',
    'carbs_g',
    'fat_g',
    'fiber_g',
];

function addDays(dateString, amount) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function round(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(rows, field) {
    if (rows.length === 0) {
        return null;
    }

    const total = rows.reduce(
        (sum, row) => sum + Number(row[field] ?? 0),
        0,
    );

    return round(total / rows.length);
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
            const hasNutritionData = Boolean(summary && entriesCount > 0);

            return {
                date,
                hasSummary: Boolean(summary),
                hasNutritionData,
                entriesCount,

                kcal: summary ? Number(summary.kcal) : null,
                proteinG: summary ? Number(summary.protein_g) : null,
                carbsG: summary ? Number(summary.carbs_g) : null,
                fatG: summary ? Number(summary.fat_g) : null,
                fiberG: summary ? Number(summary.fiber_g) : null,

                tdeeKcal: summary ? Number(summary.tdee_kcal) : null,
                targetKcal: summary ? Number(summary.target_kcal) : null,
                targetProteinG: summary
                    ? Number(summary.target_protein_g)
                    : null,
                targetFiberG: summary
                    ? Number(summary.target_fiber_g)
                    : null,

                proteinStatus: summary?.protein_status ?? null,
                trainingNotes: summary?.training_notes ?? '',
            };
        });

        // Solo los días con registros nutricionales participan
        // en los promedios.
        const registeredDays = days.filter(
            (day) => day.hasNutritionData,
        );

        const averages = {
            kcal: average(registeredDays, 'kcal'),
            proteinG: average(registeredDays, 'proteinG'),
            carbsG: average(registeredDays, 'carbsG'),
            fatG: average(registeredDays, 'fatG'),
            fiberG: average(registeredDays, 'fiberG'),
            targetKcal: average(registeredDays, 'targetKcal'),
            targetProteinG: average(registeredDays, 'targetProteinG'),
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