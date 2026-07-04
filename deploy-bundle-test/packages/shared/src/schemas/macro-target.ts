import { z } from 'zod';
import { macroCaloriesError } from '../macro-calories';

const macroCaloriesFields = {
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
};

function withMacroCaloriesValidation<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const row = data as {
      calories: number;
      proteinG: number;
      fatG: number;
      carbsG: number;
    };
    const error = macroCaloriesError(row.calories, row.proteinG, row.fatG, row.carbsG);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });
}

const macroTargetBaseSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...macroCaloriesFields,
});

export const macroTargetInputSchema = withMacroCaloriesValidation(macroTargetBaseSchema);

export const macroTargetSchema = withMacroCaloriesValidation(
  macroTargetBaseSchema.extend({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable().optional(),
  }),
);

export const macroTargetQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type MacroTargetInput = z.infer<typeof macroTargetInputSchema>;
export type MacroTarget = z.infer<typeof macroTargetSchema>;
