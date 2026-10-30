import { NutritionService } from './nutrition.service.js';
import { nutritionTargetSchema } from './nutrition.schema.js';

export const calculateMetabolicTarget = (req, res, next) => {
const validation = nutritionTargetSchema.safeParse(req.body);

if (!validation.success) {
return res.status(400).json({
success: false,
message: 'Los datos enviados no son válidos.',
errors: validation.error.issues.map((issue) => ({
field: issue.path.join('.'),
message: issue.message,
})),
});
}

try {
const result = NutritionService.computeTargetSplit(validation.data);

return res.status(200).json({
  success: true,
  data: result,
  message: 'Cálculo metabólico procesado correctamente.',
});

} catch (error) {
next(error);
}
};