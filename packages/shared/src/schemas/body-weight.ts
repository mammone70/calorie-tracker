import { z } from 'zod';
import { WEIGHT_UNITS } from '../constants';

export const bodyWeightLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().positive(),
  unit: z.enum(WEIGHT_UNITS),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const upsertBodyWeightLogSchema = z.object({
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().positive().max(2000),
  unit: z.enum(WEIGHT_UNITS).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const bodyWeightRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forUserId: z.string().uuid().optional(),
});

export const bodyWeightDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forUserId: z.string().uuid().optional(),
});

export type BodyWeightLog = z.infer<typeof bodyWeightLogSchema>;
export type UpsertBodyWeightLogInput = z.infer<typeof upsertBodyWeightLogSchema>;
