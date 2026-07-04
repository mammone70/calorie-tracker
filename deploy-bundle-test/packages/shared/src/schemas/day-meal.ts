import { z } from 'zod';
import { MAX_MEALS_PER_DAY, MIN_MEALS_PER_DAY } from '../constants';
import { mealTimeSchema } from './weekly-meal';

export const dayMealInputSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealIndex: z.number().int().min(0).max(MAX_MEALS_PER_DAY - 1),
  name: z.string().min(1).max(100),
  mealTime: mealTimeSchema,
});

export const dayMealSchema = dayMealInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const setDayMealCountSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealCount: z.number().int().min(MIN_MEALS_PER_DAY).max(MAX_MEALS_PER_DAY),
});

export type DayMealInput = z.infer<typeof dayMealInputSchema>;
export type DayMeal = z.infer<typeof dayMealSchema>;
export type SetDayMealCountInput = z.infer<typeof setDayMealCountSchema>;
