import { v4 as uuidv4 } from 'uuid';
import type { SyncEntityType } from '@calorie-tracker/shared';
import type { ApiClient } from './api-client';
import type { LocalDatabase } from './types';

type OutboxMutation = {
  entityType: SyncEntityType;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  clientUpdatedAt: string;
};

export function createSyncEngine(api: ApiClient, db: LocalDatabase) {
  async function queueMutation(mutation: OutboxMutation) {
    await db.insertOutbox({
      id: uuidv4(),
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      action: mutation.action,
      payload: mutation.payload ? JSON.stringify(mutation.payload) : null,
      clientUpdatedAt: mutation.clientUpdatedAt,
      createdAt: new Date().toISOString(),
    });
  }

  async function runSync() {
    if (!api.isAuthenticated()) return;

    const outbox = await db.getAllOutbox();

    if (outbox.length > 0) {
      const mutations = outbox.map((row) => ({
        entityType: row.entityType as SyncEntityType,
        entityId: row.entityId,
        action: row.action as 'create' | 'update' | 'delete',
        payload: row.payload ? JSON.parse(row.payload) : undefined,
        clientUpdatedAt: row.clientUpdatedAt,
      }));

      await api.syncPush(mutations);
      await db.deleteOutboxByIds(outbox.map((row) => row.id));
    }

    const since = await db.getSyncMetaValue('last_sync');

    const pull = (await api.syncPull(since)) as {
      macroTargets: Array<Record<string, unknown>>;
      weeklyMacroTargets: Array<Record<string, unknown>>;
      weeklyMeals: Array<Record<string, unknown>>;
      weeklyMealPlanEntries: Array<Record<string, unknown>>;
      dayMeals: Array<Record<string, unknown>>;
      foods: Array<Record<string, unknown>>;
      mealPlanEntries: Array<Record<string, unknown>>;
      foodLogEntries: Array<Record<string, unknown>>;
      serverTime: string;
    };

    for (const row of pull.macroTargets) {
      await upsertLocalMacroTarget(row);
    }
    for (const row of pull.weeklyMacroTargets ?? []) {
      await upsertLocalWeeklyMacroTarget(row);
    }
    for (const row of pull.weeklyMeals ?? []) {
      await upsertLocalWeeklyMeal(row);
    }
    for (const row of pull.weeklyMealPlanEntries ?? []) {
      await upsertLocalWeeklyMealPlanEntry(row);
    }
    for (const row of pull.dayMeals ?? []) {
      await upsertLocalDayMeal(row);
    }
    for (const row of pull.foods) {
      await upsertLocalFood(row);
    }
    for (const row of pull.mealPlanEntries) {
      await upsertLocalMealPlan(row);
    }
    for (const row of pull.foodLogEntries) {
      await upsertLocalFoodLog(row);
    }

    await db.upsertSyncMeta('last_sync', pull.serverTime);
  }

  async function upsertLocalMacroTarget(row: Record<string, unknown>) {
    await db.upsertMacroTarget({
      id: row.id as string,
      userId: row.userId as string,
      targetDate: row.targetDate as string,
      calories: row.calories as number,
      proteinG: row.proteinG as number,
      fatG: row.fatG as number,
      carbsG: row.carbsG as number,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalWeeklyMacroTarget(row: Record<string, unknown>) {
    await db.upsertWeeklyMacroTarget({
      id: row.id as string,
      userId: row.userId as string,
      dayOfWeek: row.dayOfWeek as number,
      calories: row.calories as number,
      proteinG: row.proteinG as number,
      fatG: row.fatG as number,
      carbsG: row.carbsG as number,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalWeeklyMeal(row: Record<string, unknown>) {
    await db.upsertWeeklyMeal({
      id: row.id as string,
      userId: row.userId as string,
      dayOfWeek: row.dayOfWeek as number,
      mealIndex: row.mealIndex as number,
      name: row.name as string,
      mealTime: (row.mealTime as string | null) ?? null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalWeeklyMealPlanEntry(row: Record<string, unknown>) {
    await db.upsertWeeklyMealPlanEntry({
      id: row.id as string,
      userId: row.userId as string,
      weeklyMealId: row.weeklyMealId as string,
      foodId: row.foodId as string,
      quantity: row.quantity as number,
      unit: row.unit as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalDayMeal(row: Record<string, unknown>) {
    await db.upsertDayMeal({
      id: row.id as string,
      userId: row.userId as string,
      planDate: row.planDate as string,
      mealIndex: row.mealIndex as number,
      name: row.name as string,
      mealTime: (row.mealTime as string | null) ?? null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalFood(row: Record<string, unknown>) {
    await db.upsertFood({
      id: row.id as string,
      userId: row.userId as string,
      name: row.name as string,
      brand: (row.brand as string | undefined) ?? null,
      source: row.source as string,
      externalId: (row.externalId as string | undefined) ?? null,
      nutrientsPer100g: JSON.stringify(row.nutrientsPer100g),
      servingSizes: row.servingSizes ? JSON.stringify(row.servingSizes) : null,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalMealPlan(row: Record<string, unknown>) {
    await db.upsertMealPlanEntry({
      id: row.id as string,
      userId: row.userId as string,
      planDate: row.planDate as string,
      dayMealId: row.dayMealId as string,
      foodId: row.foodId as string,
      quantity: row.quantity as number,
      unit: row.unit as string,
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  async function upsertLocalFoodLog(row: Record<string, unknown>) {
    await db.upsertFoodLogEntry({
      id: row.id as string,
      userId: row.userId as string,
      loggedAt: row.loggedAt as string,
      weeklyMealId: (row.weeklyMealId as string | null) ?? null,
      dayMealId: (row.dayMealId as string | null) ?? null,
      foodId: row.foodId as string,
      quantity: row.quantity as number,
      unit: row.unit as string,
      status: (row.status as string) ?? 'confirmed',
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      deletedAt: (row.deletedAt as string | null) ?? null,
    });
  }

  return { queueMutation, runSync };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
