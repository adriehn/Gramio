import { z } from 'zod';

export const nutritionTargetSchema = z
.object({
sex: z.enum(['male', 'female']),

age: z.number().int().min(14).max(120),

weightKg: z.number().finite().min(20).max(500),

heightCm: z.number().finite().min(80).max(250),

formula: z.enum(['mifflin', 'harris', 'katch']),

bodyFatPct: z.number().finite().min(2).max(75).optional().nullable(),

activityFactor: z.number().finite().min(1).max(2.5),

kcalAdjustment: z.number().finite().min(-3000).max(3000),

proteinRatioPerKg: z.number().finite().min(0.5).max(3.5),

fatMode: z.enum(['per_kg', 'pct_kcal', 'fixed']),

fatValue: z.number().finite().min(0).max(500),

fiberMode: z.enum(['per_1000kcal', 'fixed']),

fiberValue: z.number().finite().min(0).max(100),

})
.superRefine((data, ctx) => {
if (data.formula === 'katch' && data.bodyFatPct == null) {
ctx.addIssue({
code: 'custom',
path: ['bodyFatPct'],
message: 'El porcentaje de grasa corporal es obligatorio para la fórmula Katch.',
});
}

if (data.fatMode === 'per_kg' && data.fatValue > 2.5) {
  ctx.addIssue({
    code: 'custom',
    path: ['fatValue'],
    message: 'El valor de grasas por kg no puede superar 2.5.',
  });
}

if (data.fatMode === 'pct_kcal' && (data.fatValue < 10 || data.fatValue > 70)) {
  ctx.addIssue({
    code: 'custom',
    path: ['fatValue'],
    message: 'El porcentaje de grasas debe estar entre 10 y 70.',
  });
}

if (data.fiberMode === 'per_1000kcal' && data.fiberValue > 50) {
  ctx.addIssue({
    code: 'custom',
    path: ['fiberValue'],
    message: 'La fibra por cada 1000 kcal no puede superar 50 g.',
  });
}

});