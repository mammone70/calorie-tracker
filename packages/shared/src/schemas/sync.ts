import { z } from 'zod';
import { SYNC_ENTITY_TYPES } from '../constants';
import { foodSchema } from './food';
import { macroTargetSchema } from './macro-target';
import { weeklyMacroTargetSchema } from './weekly-macro-target';
import { mealPlanEntrySchema } from './meal-plan';
import { foodLogEntrySchema } from './food-log';

export const syncQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const syncPushMutationSchema = z.object({
  entityType: z.enum(SYNC_ENTITY_TYPES),
  entityId: z.string().uuid(),
  action: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.unknown()).optional(),
  clientUpdatedAt: z.string().datetime(),
});

export const syncPushSchema = z.object({
  mutations: z.array(syncPushMutationSchema),
});

export const syncPullResponseSchema = z.object({
  macroTargets: z.array(macroTargetSchema),
  weeklyMacroTargets: z.array(weeklyMacroTargetSchema),
  foods: z.array(foodSchema),
  mealPlanEntries: z.array(mealPlanEntrySchema),
  foodLogEntries: z.array(foodLogEntrySchema),
  serverTime: z.string().datetime(),
});

export type SyncPushMutation = z.infer<typeof syncPushMutationSchema>;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
