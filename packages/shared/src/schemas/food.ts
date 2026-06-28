import { z } from 'zod';
import { macroCaloriesError } from '../macro-calories';
import { FOOD_SOURCES } from '../constants';

export const nutrientsSchema = z
  .object({
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
  })
  .superRefine((data, ctx) => {
    const error = macroCaloriesError(data.calories, data.protein, data.fat, data.carbs);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });

export const servingSizeSchema = z.object({
  label: z.string(),
  grams: z.number().positive(),
});

export const createFoodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  source: z.enum(FOOD_SOURCES).default('user'),
  externalId: z.string().optional(),
  nutrientsPer100g: nutrientsSchema,
  servingSizes: z.array(servingSizeSchema).optional(),
});

export const updateFoodSchema = createFoodSchema.partial();

export const foodSchema = createFoodSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const foodSearchResultSchema = z.object({
  externalId: z.string(),
  source: z.enum(['usda', 'open_food_facts']),
  name: z.string(),
  brand: z.string().optional(),
  nutrientsPer100g: nutrientsSchema,
  servingSizes: z.array(servingSizeSchema).optional(),
});

export const foodSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type Nutrients = z.infer<typeof nutrientsSchema>;
export type ServingSize = z.infer<typeof servingSizeSchema>;
export type CreateFoodInput = z.infer<typeof createFoodSchema>;
export type UpdateFoodInput = z.infer<typeof updateFoodSchema>;
export type Food = z.infer<typeof foodSchema>;
export type FoodSearchResult = z.infer<typeof foodSearchResultSchema>;
