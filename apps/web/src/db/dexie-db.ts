import Dexie, { type Table } from 'dexie';
import type {
  DayMealRow,
  FoodLogEntryRow,
  FoodRow,
  LocalDatabase,
  MacroTargetRow,
  MealPlanEntryRow,
  OutboxRow,
  WeeklyMacroTargetRow,
  WeeklyMealPlanEntryRow,
  WeeklyMealRow,
} from '@calorie-tracker/client';

type SyncMetaRow = { key: string; value: string };

class CalorieTrackerDexie extends Dexie {
  macroTargets!: Table<MacroTargetRow, string>;
  weeklyMacroTargets!: Table<WeeklyMacroTargetRow, string>;
  weeklyMeals!: Table<WeeklyMealRow, string>;
  weeklyMealPlanEntries!: Table<WeeklyMealPlanEntryRow, string>;
  dayMeals!: Table<DayMealRow, string>;
  foods!: Table<FoodRow, string>;
  mealPlanEntries!: Table<MealPlanEntryRow, string>;
  foodLogEntries!: Table<FoodLogEntryRow, string>;
  syncOutbox!: Table<OutboxRow, string>;
  syncMeta!: Table<SyncMetaRow, string>;

  constructor() {
    super('calorie_tracker');
    this.version(1).stores({
      macroTargets: 'id, userId, targetDate',
      weeklyMacroTargets: 'id, userId, dayOfWeek',
      foods: 'id, userId',
      mealPlanEntries: 'id, userId, planDate',
      foodLogEntries: 'id, userId, loggedAt',
      syncOutbox: 'id, entityType, entityId',
      syncMeta: 'key',
    });
    this.version(2).stores({
      weeklyMealPlanEntries: 'id, userId, dayOfWeek',
    });
    this.version(3).stores({
      weeklyMeals: 'id, userId, dayOfWeek',
      dayMeals: 'id, userId, planDate',
      weeklyMealPlanEntries: 'id, userId, weeklyMealId',
      mealPlanEntries: 'id, userId, planDate, dayMealId',
    });
    this.version(4)
      .stores({
        foodLogEntries: 'id, userId, loggedAt, status',
      })
      .upgrade(async (tx) => {
        await tx
          .table('foodLogEntries')
          .toCollection()
          .modify((row) => {
            if (!row.status) row.status = 'confirmed';
          });
      });
  }
}

export const dexie = new CalorieTrackerDexie();

export const dexieDatabase: LocalDatabase = {
  async getAllOutbox() {
    return dexie.syncOutbox.toArray();
  },

  async insertOutbox(row) {
    await dexie.syncOutbox.put(row);
  },

  async deleteOutboxByIds(ids) {
    await dexie.syncOutbox.bulkDelete(ids);
  },

  async getSyncMetaValue(key) {
    const row = await dexie.syncMeta.get(key);
    return row?.value;
  },

  async upsertSyncMeta(key, value) {
    await dexie.syncMeta.put({ key, value });
  },

  async upsertMacroTarget(row) {
    await dexie.macroTargets.put(row);
  },

  async upsertWeeklyMacroTarget(row) {
    await dexie.weeklyMacroTargets.put(row);
  },

  async upsertWeeklyMeal(row) {
    await dexie.weeklyMeals.put(row);
  },

  async upsertWeeklyMealPlanEntry(row) {
    await dexie.weeklyMealPlanEntries.put(row);
  },

  async upsertDayMeal(row) {
    await dexie.dayMeals.put(row);
  },

  async upsertFood(row) {
    await dexie.foods.put(row);
  },

  async upsertMealPlanEntry(row) {
    await dexie.mealPlanEntries.put(row);
  },

  async upsertFoodLogEntry(row) {
    await dexie.foodLogEntries.put(row);
  },

  async findMacroTarget(userId, targetDate) {
    const rows = await dexie.macroTargets
      .filter((row) => row.userId === userId && row.targetDate === targetDate && !row.deletedAt)
      .toArray();
    return rows[0];
  },

  async insertOrUpdateMacroTarget(record) {
    await dexie.macroTargets.put(record);
  },

  async softDeleteMacroTarget(id, deletedAt, updatedAt) {
    await dexie.macroTargets.update(id, { deletedAt, updatedAt });
  },

  async findWeeklyMacroTarget(userId, dayOfWeek) {
    const rows = await dexie.weeklyMacroTargets
      .filter((row) => row.userId === userId && row.dayOfWeek === dayOfWeek && !row.deletedAt)
      .toArray();
    return rows[0];
  },

  async insertOrUpdateWeeklyMacroTarget(record) {
    await dexie.weeklyMacroTargets.put(record);
  },

  async insertWeeklyMeal(record) {
    await dexie.weeklyMeals.put(record);
  },

  async softDeleteWeeklyMeal(id, deletedAt, updatedAt) {
    await dexie.weeklyMeals.update(id, { deletedAt, updatedAt });
  },

  async insertWeeklyMealPlanEntry(record) {
    await dexie.weeklyMealPlanEntries.put(record);
  },

  async softDeleteWeeklyMealPlanEntry(id, deletedAt, updatedAt) {
    await dexie.weeklyMealPlanEntries.update(id, { deletedAt, updatedAt });
  },

  async insertDayMeal(record) {
    await dexie.dayMeals.put(record);
  },

  async softDeleteDayMeal(id, deletedAt, updatedAt) {
    await dexie.dayMeals.update(id, { deletedAt, updatedAt });
  },

  async insertFood(record) {
    await dexie.foods.put(record);
  },

  async insertFoodLogEntry(record) {
    await dexie.foodLogEntries.put(record);
  },

  async softDeleteFoodLogEntry(id, deletedAt, updatedAt) {
    await dexie.foodLogEntries.update(id, { deletedAt, updatedAt });
  },

  async getMacroTargets(userId, from, to) {
    return dexie.macroTargets
      .filter(
        (row) =>
          row.userId === userId &&
          !row.deletedAt &&
          row.targetDate >= from &&
          row.targetDate <= to,
      )
      .toArray();
  },

  async getWeeklyMacroTargets(userId) {
    return dexie.weeklyMacroTargets
      .filter((row) => row.userId === userId && !row.deletedAt)
      .toArray();
  },

  async getWeeklyMeals(userId) {
    return dexie.weeklyMeals.filter((row) => row.userId === userId && !row.deletedAt).toArray();
  },

  async getWeeklyMealPlanEntries(userId) {
    return dexie.weeklyMealPlanEntries
      .filter((row) => row.userId === userId && !row.deletedAt)
      .toArray();
  },

  async getDayMeals(userId) {
    return dexie.dayMeals.filter((row) => row.userId === userId && !row.deletedAt).toArray();
  },

  async getFoods(userId) {
    return dexie.foods.filter((row) => row.userId === userId && !row.deletedAt).toArray();
  },

  async getFoodLogEntries(userId) {
    return dexie.foodLogEntries
      .filter((row) => row.userId === userId && !row.deletedAt)
      .toArray();
  },
};
