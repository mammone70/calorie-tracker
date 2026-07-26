import { z } from 'zod';

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  /** Global catalog entry — defaults to true for new exercises. */
  isGlobal: z.boolean().optional().default(true),
});

export const updateExerciseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional().nullable(),
  isGlobal: z.boolean().optional(),
});

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  notes: z.string().nullable().optional(),
  isGlobal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const exerciseSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  forUserId: z.string().uuid().optional(),
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
