export type MacroTargetRow = {
  id: string;
  userId: string;
  targetDate: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WeeklyMacroTargetRow = {
  id: string;
  userId: string;
  dayOfWeek: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FoodRow = {
  id: string;
  userId: string;
  name: string;
  brand: string | null;
  source: string;
  externalId: string | null;
  nutrientsPer100g: string;
  servingSizes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WeeklyMealRow = {
  id: string;
  userId: string;
  dayOfWeek: number;
  mealIndex: number;
  name: string;
  mealTime: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WeeklyMealPlanEntryRow = {
  id: string;
  userId: string;
  weeklyMealId: string;
  foodId: string;
  quantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DayMealRow = {
  id: string;
  userId: string;
  planDate: string;
  mealIndex: number;
  name: string;
  mealTime: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type MealPlanEntryRow = {
  id: string;
  userId: string;
  planDate: string;
  dayMealId: string;
  foodId: string;
  quantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FoodLogEntryRow = {
  id: string;
  userId: string;
  loggedAt: string;
  weeklyMealId: string | null;
  dayMealId: string | null;
  foodId: string;
  quantity: number;
  unit: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type OutboxRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: string | null;
  clientUpdatedAt: string;
  createdAt: string;
};

export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  getUserId(): Promise<string | null>;
  getUserRole(): Promise<'client' | 'admin' | null>;
  getUserEmail(): Promise<string | null>;
  setTokens(
    accessToken: string,
    refreshToken: string,
    user?: { id: string; role?: 'client' | 'admin'; email?: string },
  ): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface LocalDatabase {
  getAllOutbox(): Promise<OutboxRow[]>;
  insertOutbox(row: OutboxRow): Promise<void>;
  deleteOutboxByIds(ids: string[]): Promise<void>;
  getSyncMetaValue(key: string): Promise<string | undefined>;
  upsertSyncMeta(key: string, value: string): Promise<void>;

  upsertMacroTarget(row: MacroTargetRow): Promise<void>;
  upsertWeeklyMacroTarget(row: WeeklyMacroTargetRow): Promise<void>;
  upsertWeeklyMeal(row: WeeklyMealRow): Promise<void>;
  upsertWeeklyMealPlanEntry(row: WeeklyMealPlanEntryRow): Promise<void>;
  upsertDayMeal(row: DayMealRow): Promise<void>;
  upsertFood(row: FoodRow): Promise<void>;
  upsertMealPlanEntry(row: MealPlanEntryRow): Promise<void>;
  upsertFoodLogEntry(row: FoodLogEntryRow): Promise<void>;

  findMacroTarget(userId: string, targetDate: string): Promise<MacroTargetRow | undefined>;
  insertOrUpdateMacroTarget(record: MacroTargetRow): Promise<void>;
  softDeleteMacroTarget(id: string, deletedAt: string, updatedAt: string): Promise<void>;

  findWeeklyMacroTarget(
    userId: string,
    dayOfWeek: number,
  ): Promise<WeeklyMacroTargetRow | undefined>;
  insertOrUpdateWeeklyMacroTarget(record: WeeklyMacroTargetRow): Promise<void>;

  insertWeeklyMeal(record: WeeklyMealRow): Promise<void>;
  softDeleteWeeklyMeal(id: string, deletedAt: string, updatedAt: string): Promise<void>;
  insertWeeklyMealPlanEntry(record: WeeklyMealPlanEntryRow): Promise<void>;
  softDeleteWeeklyMealPlanEntry(id: string, deletedAt: string, updatedAt: string): Promise<void>;

  insertDayMeal(record: DayMealRow): Promise<void>;
  softDeleteDayMeal(id: string, deletedAt: string, updatedAt: string): Promise<void>;
  insertMealPlanEntry(record: MealPlanEntryRow): Promise<void>;
  softDeleteMealPlanEntry(id: string, deletedAt: string, updatedAt: string): Promise<void>;

  insertFood(record: FoodRow): Promise<void>;
  insertFoodLogEntry(record: FoodLogEntryRow): Promise<void>;
  softDeleteFoodLogEntry(id: string, deletedAt: string, updatedAt: string): Promise<void>;

  getMacroTargets(userId: string, from: string, to: string): Promise<MacroTargetRow[]>;
  getWeeklyMacroTargets(userId: string): Promise<WeeklyMacroTargetRow[]>;
  getWeeklyMeals(userId: string): Promise<WeeklyMealRow[]>;
  getWeeklyMealPlanEntries(userId: string): Promise<WeeklyMealPlanEntryRow[]>;
  getDayMeals(userId: string): Promise<DayMealRow[]>;
  getMealPlanEntries(userId: string, planDate?: string): Promise<MealPlanEntryRow[]>;
  getFoods(userId: string): Promise<FoodRow[]>;
  getFoodLogEntries(userId: string): Promise<FoodLogEntryRow[]>;
}
