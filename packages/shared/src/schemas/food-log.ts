import { z } from 'zod';
import { MEAL_SLOTS } from '../constants';

export const foodLogEntryInputSchema = z.object({
  loggedAt: z.string().datetime(),
  mealSlot: z.enum(MEAL_SLOTS),
  foodId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1).default('g'),
});

export const foodLogEntrySchema = foodLogEntryInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const foodLogQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type FoodLogEntryInput = z.infer<typeof foodLogEntryInputSchema>;
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;
