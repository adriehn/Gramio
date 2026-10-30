import { z } from 'zod';

const nonNegativeMacro = z
  .number()
  .finite()
  .min(0)
  .max(100000);

const manualMacrosSchema = z.object({
  kcal_100: nonNegativeMacro,
  protein_100: nonNegativeMacro,
  carbs_100: nonNegativeMacro,
  fat_100: nonNegativeMacro,
  fiber_100: nonNegativeMacro
}).strict();

const databaseIngredientSchema = z.object({
  source: z.literal('database'),
  quantity_g: z.number().finite().positive().max(100000),
  food_id: z.string().uuid()
}).strict();

const manualIngredientSchema = z.object({
  source: z.literal('manual'),
  quantity_g: z.number().finite().positive().max(100000),
  manual_name: z.string().trim().min(1).max(120),
  manual_macros: manualMacrosSchema
}).strict();

const ingredientSchema = z.discriminatedUnion('source', [
  databaseIngredientSchema,
  manualIngredientSchema
]);

export const createRecipeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  is_cooked: z.boolean().optional()
}).strict();