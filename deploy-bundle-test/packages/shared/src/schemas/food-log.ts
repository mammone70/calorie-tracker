import { z } from 'zod';
import { FOOD_LOG_STATUSES } from '../constants';

function mealRefRefinement(
  value: { weeklyMealId?: string; dayMealId?: string },
  ctx: z.RefinementCtx,
) {
  const hasWeekly = !!value.weeklyMealId;
  const hasDay = !!value.dayMealId;
  if (!hasWeekly && !hasDay) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either weeklyMealId or dayMealId is required',
      path: ['weeklyMealId'],
    });
  }
  if (hasWeekly && hasDay) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only one of weeklyMealId or dayMealId may be set',
      path: ['weeklyMealId'],
    });
  }
}

export const foodLogEntryInputBaseSchema = z.object({
  loggedAt: z.string().datetime(),
  weeklyMealId: z.string().uuid().optional(),
  dayMealId: z.string().uuid().optional(),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1).default('g'),
  status: z.enum(FOOD_LOG_STATUSES).optional(),
});

export const foodLogEntryInputSchema = foodLogEntryInputBaseSchema.superRefine(mealRefRefinement);

export const foodLogEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  loggedAt: z.string().datetime(),
  weeklyMealId: z.string().uuid().nullable().optional(),
  dayMealId: z.string().uuid().nullable().optional(),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  status: z.enum(FOOD_LOG_STATUSES),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const foodLogQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const materializeFoodLogsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type FoodLogEntryInput = z.infer<typeof foodLogEntryInputSchema>;
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;
