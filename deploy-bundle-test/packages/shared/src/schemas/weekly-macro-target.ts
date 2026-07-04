import { z } from 'zod';
import { macroCaloriesError } from '../macro-calories';

export const weekdayIndexSchema = z.number().int().min(0).max(6);

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

const weeklyMacroTargetBaseSchema = z.object({
  dayOfWeek: weekdayIndexSchema,
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
});

export const weeklyMacroTargetInputSchema = withMacroCaloriesValidation(
  weeklyMacroTargetBaseSchema,
);

export const weeklyMacroTargetSchema = withMacroCaloriesValidation(
  weeklyMacroTargetBaseSchema.extend({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable().optional(),
  }),
);

export const effectiveMacroTargetSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calories: z.number().int().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  source: z.enum(['override', 'weekly', 'none']),
  overrideId: z.string().uuid().optional(),
  weeklyDayOfWeek: weekdayIndexSchema.optional(),
});

export type WeeklyMacroTargetInput = z.infer<typeof weeklyMacroTargetInputSchema>;
export type WeeklyMacroTarget = z.infer<typeof weeklyMacroTargetSchema>;
export type EffectiveMacroTarget = z.infer<typeof effectiveMacroTargetSchema>;
