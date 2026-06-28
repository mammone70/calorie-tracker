import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  getDb,
  localMacroTargets,
  localFoods,
  localMealPlanEntries,
  localFoodLogEntries,
} from './db';
import { queueMutation, runSync } from './sync';
import type { CreateFoodInput, MacroTargetInput, FoodLogEntryInput } from '@calorie-tracker/shared';

export async function localUpsertMacroTarget(userId: string, input: MacroTargetInput) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  const existing = await db
    .select()
    .from(localMacroTargets)
    .where(
      and(
        eq(localMacroTargets.userId, userId),
        eq(localMacroTargets.targetDate, input.targetDate),
        isNull(localMacroTargets.deletedAt),
      ),
    );

  const record = {
    id: existing[0]?.id ?? id,
    userId,
    targetDate: input.targetDate,
    calories: input.calories,
    proteinG: input.proteinG,
    fatG: input.fatG,
    carbsG: input.carbsG,
    createdAt: existing[0]?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null as string | null,
  };

  await db.insert(localMacroTargets).values(record).onConflictDoUpdate({
    target: localMacroTargets.id,
    set: record,
  });

  await queueMutation({
    entityType: 'macro_targets',
    entityId: record.id,
    action: existing[0] ? 'update' : 'create',
    payload: input as unknown as Record<string, unknown>,
    clientUpdatedAt: now,
  });

  try {
    await runSync();
  } catch {
    // Offline — outbox will sync later
  }

  return record;
}

export async function localCreateFood(userId: string, input: CreateFoodInput) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  const record = {
    id,
    userId,
    name: input.name,
    brand: input.brand ?? null,
    source: input.source ?? 'user',
    externalId: input.externalId ?? null,
    nutrientsPer100g: JSON.stringify(input.nutrientsPer100g),
    servingSizes: input.servingSizes ? JSON.stringify(input.servingSizes) : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null as string | null,
  };

  await db.insert(localFoods).values(record);

  await queueMutation({
    entityType: 'foods',
    entityId: id,
    action: 'create',
    payload: input as unknown as Record<string, unknown>,
    clientUpdatedAt: now,
  });

  try {
    await runSync();
  } catch {
    // queued for later
  }

  return { ...record, nutrientsPer100g: input.nutrientsPer100g };
}

export async function localCreateFoodLog(userId: string, input: FoodLogEntryInput) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  const record = {
    id,
    userId,
    loggedAt: input.loggedAt,
    mealSlot: input.mealSlot,
    foodId: input.foodId,
    quantity: input.quantity,
    unit: input.unit,
    createdAt: now,
    updatedAt: now,
    deletedAt: null as string | null,
  };

  await db.insert(localFoodLogEntries).values(record);

  await queueMutation({
    entityType: 'food_log_entries',
    entityId: id,
    action: 'create',
    payload: input as unknown as Record<string, unknown>,
    clientUpdatedAt: now,
  });

  try {
    await runSync();
  } catch {
    // queued for later
  }

  return record;
}

export async function localGetMacroTargets(userId: string, from: string, to: string) {
  const db = await getDb();
  return db
    .select()
    .from(localMacroTargets)
    .where(
      and(
        eq(localMacroTargets.userId, userId),
        gte(localMacroTargets.targetDate, from),
        lte(localMacroTargets.targetDate, to),
        isNull(localMacroTargets.deletedAt),
      ),
    );
}

export async function localGetFoods(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(localFoods)
    .where(and(eq(localFoods.userId, userId), isNull(localFoods.deletedAt)));

  return rows.map((row) => ({
    ...row,
    nutrientsPer100g: JSON.parse(row.nutrientsPer100g),
    servingSizes: row.servingSizes ? JSON.parse(row.servingSizes) : undefined,
  }));
}

export async function localGetFoodLogs(userId: string, date: string) {
  const db = await getDb();
  return db
    .select()
    .from(localFoodLogEntries)
    .where(
      and(
        eq(localFoodLogEntries.userId, userId),
        isNull(localFoodLogEntries.deletedAt),
      ),
    )
    .then((rows) =>
      rows.filter((row) => row.loggedAt.slice(0, 10) === date),
    );
}
