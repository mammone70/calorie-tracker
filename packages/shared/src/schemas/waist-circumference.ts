import { z } from 'zod';

export const waistCircumferenceLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inches: z.number().positive(),
  notes: z.string().max(500).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const upsertWaistCircumferenceLogSchema = z.object({
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inches: z.number().positive().max(100),
  notes: z.string().max(500).optional().nullable(),
});

export const waistCircumferenceRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forUserId: z.string().uuid().optional(),
});

export const waistCircumferenceDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forUserId: z.string().uuid().optional(),
});

export type WaistCircumferenceLog = z.infer<typeof waistCircumferenceLogSchema>;
export type UpsertWaistCircumferenceLogInput = z.infer<typeof upsertWaistCircumferenceLogSchema>;
