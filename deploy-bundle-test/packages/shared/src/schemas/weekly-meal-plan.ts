import { z } from 'zod';

export const weeklyMealPlanEntryInputSchema = z.object({
  weeklyMealId: z.string().uuid(),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1).default('g'),
});

export const weeklyMealPlanEntrySchema = weeklyMealPlanEntryInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const mealPlanFoodEntrySchema = z.object({
  id: z.string().uuid(),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const effectiveMealBlockSchema = z.object({
  id: z.string().uuid(),
  mealIndex: z.number().int(),
  name: z.string(),
  mealTime: z.string().nullable(),
  source: z.enum(['override', 'weekly']),
  entries: z.array(mealPlanFoodEntrySchema),
});

export const effectiveMealPlanSchema = z.object({
  source: z.enum(['override', 'weekly', 'none']),
  meals: z.array(effectiveMealBlockSchema),
});

export type WeeklyMealPlanEntryInput = z.infer<typeof weeklyMealPlanEntryInputSchema>;
export type WeeklyMealPlanEntry = z.infer<typeof weeklyMealPlanEntrySchema>;
export type MealPlanFoodEntry = z.infer<typeof mealPlanFoodEntrySchema>;
export type EffectiveMealBlock = z.infer<typeof effectiveMealBlockSchema>;
export type EffectiveMealPlan = z.infer<typeof effectiveMealPlanSchema>;
