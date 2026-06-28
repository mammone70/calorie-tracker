import { v4 as uuidv4 } from 'uuid';
import type {
  CreateFoodInput,
  MacroTargetInput,
  FoodLogEntryInput,
  WeeklyMacroTargetInput,
  WeeklyMealPlanEntryInput,
  WeeklyMealInput,
} from '@calorie-tracker/shared';
import { macroCaloriesError } from '@calorie-tracker/shared';
import type { ApiClient } from './api-client';
import type { LocalDatabase } from './types';
import type { SyncEngine } from './sync';

export function createLocalStore(api: ApiClient, db: LocalDatabase, sync: SyncEngine) {
  const { queueMutation, runSync } = sync;

  async function localUpsertMacroTarget(userId: string, input: MacroTargetInput) {
    const validationError = macroCaloriesError(
      input.calories,
      input.proteinG,
      input.fatG,
      input.carbsG,
    );
    if (validationError) throw new Error(validationError);

    const now = new Date().toISOString();
    const id = uuidv4();

    const existing = await db.findMacroTarget(userId, input.targetDate);

    const record = {
      id: existing?.id ?? id,
      userId,
      targetDate: input.targetDate,
      calories: input.calories,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbsG: input.carbsG,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null as string | null,
    };

    await db.insertOrUpdateMacroTarget(record);

    await queueMutation({
      entityType: 'macro_targets',
      entityId: record.id,
      action: existing ? 'update' : 'create',
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

  async function localRemoveMacroTarget(userId: string, id: string) {
    const now = new Date().toISOString();

    await db.softDeleteMacroTarget(id, now, now);

    await queueMutation({
      entityType: 'macro_targets',
      entityId: id,
      action: 'delete',
      clientUpdatedAt: now,
    });

    try {
      await runSync();
    } catch {
      // queued for later
    }
  }

  async function localUpsertWeeklyMacroTarget(userId: string, input: WeeklyMacroTargetInput) {
    const validationError = macroCaloriesError(
      input.calories,
      input.proteinG,
      input.fatG,
      input.carbsG,
    );
    if (validationError) throw new Error(validationError);

    const now = new Date().toISOString();
    const id = uuidv4();

    const existing = await db.findWeeklyMacroTarget(userId, input.dayOfWeek);

    const record = {
      id: existing?.id ?? id,
      userId,
      dayOfWeek: input.dayOfWeek,
      calories: input.calories,
      proteinG: input.proteinG,
      fatG: input.fatG,
      carbsG: input.carbsG,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null as string | null,
    };

    await db.insertOrUpdateWeeklyMacroTarget(record);

    await queueMutation({
      entityType: 'weekly_macro_targets',
      entityId: record.id,
      action: existing ? 'update' : 'create',
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

  async function localCreateFood(userId: string, input: CreateFoodInput) {
    const { nutrientsPer100g } = input;
    const validationError = macroCaloriesError(
      nutrientsPer100g.calories,
      nutrientsPer100g.protein,
      nutrientsPer100g.fat,
      nutrientsPer100g.carbs,
    );
    if (validationError) throw new Error(validationError);

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

    await db.insertFood(record);

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

  async function localCreateFoodLog(userId: string, input: FoodLogEntryInput) {
    const now = new Date().toISOString();
    const id = uuidv4();

    const record = {
      id,
      userId,
      loggedAt: input.loggedAt,
      weeklyMealId: input.weeklyMealId ?? null,
      dayMealId: input.dayMealId ?? null,
      foodId: input.foodId,
      quantity: input.quantity,
      unit: input.unit,
      status: input.status ?? 'confirmed',
      createdAt: now,
      updatedAt: now,
      deletedAt: null as string | null,
    };

    await db.insertFoodLogEntry(record);

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

  async function localUpdateFoodLog(
    userId: string,
    id: string,
    input: Partial<FoodLogEntryInput>,
  ) {
    const now = new Date().toISOString();
    const rows = await db.getFoodLogEntries(userId);
    const existing = rows.find((row) => row.id === id);
    if (!existing) throw new Error('Food log entry not found');

    const updated = {
      ...existing,
      ...(input.loggedAt !== undefined && { loggedAt: input.loggedAt }),
      ...(input.weeklyMealId !== undefined && { weeklyMealId: input.weeklyMealId ?? null }),
      ...(input.dayMealId !== undefined && { dayMealId: input.dayMealId ?? null }),
      ...(input.foodId !== undefined && { foodId: input.foodId }),
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: now,
    };

    await db.insertFoodLogEntry(updated);

    await queueMutation({
      entityType: 'food_log_entries',
      entityId: id,
      action: 'update',
      payload: input as unknown as Record<string, unknown>,
      clientUpdatedAt: now,
    });

    try {
      await runSync();
    } catch {
      // queued for later
    }

    return updated;
  }

  async function localConfirmFoodLog(userId: string, id: string) {
    return localUpdateFoodLog(userId, id, { status: 'confirmed' });
  }

  async function localRemoveFoodLog(userId: string, id: string) {
    const now = new Date().toISOString();

    await db.softDeleteFoodLogEntry(id, now, now);

    await queueMutation({
      entityType: 'food_log_entries',
      entityId: id,
      action: 'delete',
      clientUpdatedAt: now,
    });

    try {
      await runSync();
    } catch {
      // queued for later
    }
  }

  async function localGetMacroTargets(userId: string, from: string, to: string) {
    return db.getMacroTargets(userId, from, to);
  }

  async function localGetWeeklyMacroTargets(userId: string) {
    return db.getWeeklyMacroTargets(userId);
  }

  async function localGetFoods(userId: string) {
    const rows = await db.getFoods(userId);

    return rows.map((row) => ({
      ...row,
      nutrientsPer100g: JSON.parse(row.nutrientsPer100g),
      servingSizes: row.servingSizes ? JSON.parse(row.servingSizes) : undefined,
    }));
  }

  async function localCreateWeeklyMealPlanEntry(userId: string, input: WeeklyMealPlanEntryInput) {
    const now = new Date().toISOString();
    const id = uuidv4();

    const record = {
      id,
      userId,
      weeklyMealId: input.weeklyMealId,
      foodId: input.foodId,
      quantity: input.quantity,
      unit: input.unit,
      createdAt: now,
      updatedAt: now,
      deletedAt: null as string | null,
    };

    await db.insertWeeklyMealPlanEntry(record);

    await queueMutation({
      entityType: 'weekly_meal_plan_entries',
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

  async function localUpdateWeeklyMeal(userId: string, id: string, input: Partial<WeeklyMealInput>) {
    const now = new Date().toISOString();
    const meals = await db.getWeeklyMeals(userId);
    const existing = meals.find((meal) => meal.id === id);
    if (!existing) throw new Error('Weekly meal not found');

    const updated = {
      ...existing,
      ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
      ...(input.mealIndex !== undefined && { mealIndex: input.mealIndex }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.mealTime !== undefined && { mealTime: input.mealTime ?? null }),
      updatedAt: now,
    };

    await db.insertWeeklyMeal(updated);

    await queueMutation({
      entityType: 'weekly_meals',
      entityId: id,
      action: 'update',
      payload: input as unknown as Record<string, unknown>,
      clientUpdatedAt: now,
    });

    try {
      await runSync();
    } catch {
      // queued for later
    }

    return updated;
  }

  async function localSetWeeklyMealCount(
    userId: string,
    dayOfWeek: number,
    mealCount: number,
    createdMeals: Array<{ id: string; mealIndex: number; name: string }>,
  ) {
    const now = new Date().toISOString();
    const existing = await db.getWeeklyMeals(userId);
    const dayMeals = existing.filter((meal) => meal.dayOfWeek === dayOfWeek && !meal.deletedAt);

    if (dayMeals.length > mealCount) {
      const toRemove = dayMeals
        .filter((meal) => meal.mealIndex >= mealCount)
        .sort((a, b) => b.mealIndex - a.mealIndex);
      const planEntries = await db.getWeeklyMealPlanEntries(userId);
      for (const meal of toRemove) {
        for (const entry of planEntries.filter(
          (row) => row.weeklyMealId === meal.id && !row.deletedAt,
        )) {
          await db.softDeleteWeeklyMealPlanEntry(entry.id, now, now);
          await queueMutation({
            entityType: 'weekly_meal_plan_entries',
            entityId: entry.id,
            action: 'delete',
            clientUpdatedAt: now,
          });
        }
        await db.softDeleteWeeklyMeal(meal.id, now, now);
        await queueMutation({
          entityType: 'weekly_meals',
          entityId: meal.id,
          action: 'delete',
          clientUpdatedAt: now,
        });
      }
    }

    for (const meal of createdMeals) {
      const record = {
        id: meal.id,
        userId,
        dayOfWeek,
        mealIndex: meal.mealIndex,
        name: meal.name,
        mealTime: null as string | null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null as string | null,
      };
      await db.insertWeeklyMeal(record);
      await queueMutation({
        entityType: 'weekly_meals',
        entityId: meal.id,
        action: 'create',
        payload: {
          dayOfWeek,
          mealIndex: meal.mealIndex,
          name: meal.name,
        },
        clientUpdatedAt: now,
      });
    }

    try {
      await runSync();
    } catch {
      // queued for later
    }
  }

  async function localRemoveWeeklyMealPlanEntry(userId: string, id: string) {
    const now = new Date().toISOString();

    await db.softDeleteWeeklyMealPlanEntry(id, now, now);

    await queueMutation({
      entityType: 'weekly_meal_plan_entries',
      entityId: id,
      action: 'delete',
      clientUpdatedAt: now,
    });

    try {
      await runSync();
    } catch {
      // queued for later
    }
  }

  async function localGetWeeklyMealPlanEntries(userId: string) {
    return db.getWeeklyMealPlanEntries(userId);
  }

  async function localGetWeeklyMeals(userId: string) {
    return db.getWeeklyMeals(userId);
  }

  async function localGetFoodLogs(userId: string, date: string) {
    const rows = await db.getFoodLogEntries(userId);
    return rows.filter((row) => row.loggedAt.slice(0, 10) === date);
  }

  return {
    localUpsertMacroTarget,
    localRemoveMacroTarget,
    localUpsertWeeklyMacroTarget,
    localCreateWeeklyMealPlanEntry,
    localRemoveWeeklyMealPlanEntry,
    localUpdateWeeklyMeal,
    localSetWeeklyMealCount,
    localCreateFood,
    localCreateFoodLog,
    localUpdateFoodLog,
    localConfirmFoodLog,
    localRemoveFoodLog,
    localGetMacroTargets,
    localGetWeeklyMacroTargets,
    localGetWeeklyMealPlanEntries,
    localGetWeeklyMeals,
    localGetFoods,
    localGetFoodLogs,
  };
}

export type LocalStore = ReturnType<typeof createLocalStore>;
