import { z } from 'zod';

export const mealPlanEntryInputSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayMealId: z.string().uuid(),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1).default('g'),
});

export const mealPlanEntrySchema = mealPlanEntryInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const mealPlanQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type MealPlanEntryInput = z.infer<typeof mealPlanEntryInputSchema>;
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;
