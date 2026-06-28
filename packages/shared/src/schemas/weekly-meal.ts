import { z } from 'zod';
import { MAX_MEALS_PER_DAY, MIN_MEALS_PER_DAY } from '../constants';
import { weekdayIndexSchema } from './weekly-macro-target';

export const mealTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .optional();

export const weeklyMealInputSchema = z.object({
  dayOfWeek: weekdayIndexSchema,
  mealIndex: z.number().int().min(0).max(MAX_MEALS_PER_DAY - 1),
  name: z.string().min(1).max(100),
  mealTime: mealTimeSchema,
});

export const weeklyMealSchema = weeklyMealInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const setWeeklyDayMealCountSchema = z.object({
  dayOfWeek: weekdayIndexSchema,
  mealCount: z.number().int().min(MIN_MEALS_PER_DAY).max(MAX_MEALS_PER_DAY),
});

export type WeeklyMealInput = z.infer<typeof weeklyMealInputSchema>;
export type WeeklyMeal = z.infer<typeof weeklyMealSchema>;
export type SetWeeklyDayMealCountInput = z.infer<typeof setWeeklyDayMealCountSchema>;
