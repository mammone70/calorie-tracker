import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { SyncEntityType } from '@calorie-tracker/shared';
import { api } from './api';
import {
  getDb,
  syncOutbox,
  syncMeta,
  localMacroTargets,
  localWeeklyMacroTargets,
  localFoods,
  localMealPlanEntries,
  localFoodLogEntries,
} from './db';

type OutboxMutation = {
  entityType: SyncEntityType;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  clientUpdatedAt: string;
};

export async function queueMutation(mutation: OutboxMutation) {
  const db = await getDb();
  await db.insert(syncOutbox).values({
    id: uuidv4(),
    entityType: mutation.entityType,
    entityId: mutation.entityId,
    action: mutation.action,
    payload: mutation.payload ? JSON.stringify(mutation.payload) : null,
    clientUpdatedAt: mutation.clientUpdatedAt,
    createdAt: new Date().toISOString(),
  });
}

export async function runSync() {
  if (!api.isAuthenticated()) return;

  const db = await getDb();
  const outbox = await db.select().from(syncOutbox);

  if (outbox.length > 0) {
    const mutations = outbox.map((row) => ({
      entityType: row.entityType as SyncEntityType,
      entityId: row.entityId,
      action: row.action as 'create' | 'update' | 'delete',
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      clientUpdatedAt: row.clientUpdatedAt,
    }));

    await api.syncPush(mutations);

    for (const row of outbox) {
      await db.delete(syncOutbox).where(eq(syncOutbox.id, row.id));
    }
  }

  const meta = await db.select().from(syncMeta).where(eq(syncMeta.key, 'last_sync'));
  const since = meta[0]?.value;

  const pull = (await api.syncPull(since)) as {
    macroTargets: Array<Record<string, unknown>>;
    weeklyMacroTargets: Array<Record<string, unknown>>;
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
  for (const row of pull.foods) {
    await upsertLocalFood(row);
  }
  for (const row of pull.mealPlanEntries) {
    await upsertLocalMealPlan(row);
  }
  for (const row of pull.foodLogEntries) {
    await upsertLocalFoodLog(row);
  }

  const existingMeta = meta[0];
  if (existingMeta) {
    await db
      .update(syncMeta)
      .set({ value: pull.serverTime })
      .where(eq(syncMeta.key, 'last_sync'));
  } else {
    await db.insert(syncMeta).values({ key: 'last_sync', value: pull.serverTime });
  }
}

async function upsertLocalMacroTarget(row: Record<string, unknown>) {
  const db = await getDb();
  const values = {
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
  };

  await db.insert(localMacroTargets).values(values).onConflictDoUpdate({
    target: localMacroTargets.id,
    set: values,
  });
}

async function upsertLocalWeeklyMacroTarget(row: Record<string, unknown>) {
  const db = await getDb();
  const values = {
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
  };

  await db.insert(localWeeklyMacroTargets).values(values).onConflictDoUpdate({
    target: localWeeklyMacroTargets.id,
    set: values,
  });
}

async function upsertLocalFood(row: Record<string, unknown>) {
  const db = await getDb();
  const values = {
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
  };

  await db.insert(localFoods).values(values).onConflictDoUpdate({
    target: localFoods.id,
    set: values,
  });
}

async function upsertLocalMealPlan(row: Record<string, unknown>) {
  const db = await getDb();
  const values = {
    id: row.id as string,
    userId: row.userId as string,
    planDate: row.planDate as string,
    mealSlot: row.mealSlot as string,
    foodId: row.foodId as string,
    quantity: row.quantity as number,
    unit: row.unit as string,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    deletedAt: (row.deletedAt as string | null) ?? null,
  };

  await db.insert(localMealPlanEntries).values(values).onConflictDoUpdate({
    target: localMealPlanEntries.id,
    set: values,
  });
}

async function upsertLocalFoodLog(row: Record<string, unknown>) {
  const db = await getDb();
  const values = {
    id: row.id as string,
    userId: row.userId as string,
    loggedAt: row.loggedAt as string,
    mealSlot: row.mealSlot as string,
    foodId: row.foodId as string,
    quantity: row.quantity as number,
    unit: row.unit as string,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    deletedAt: (row.deletedAt as string | null) ?? null,
  };

  await db.insert(localFoodLogEntries).values(values).onConflictDoUpdate({
    target: localFoodLogEntries.id,
    set: values,
  });
}
