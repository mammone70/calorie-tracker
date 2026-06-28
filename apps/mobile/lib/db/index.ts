import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import {
  localMacroTargets,
  localWeeklyMacroTargets,
  localFoods,
  localMealPlanEntries,
  localFoodLogEntries,
  syncOutbox,
  syncMeta,
} from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS macro_targets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  target_date TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS foods (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  source TEXT NOT NULL,
  external_id TEXT,
  nutrients_per_100g TEXT NOT NULL,
  serving_sizes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  plan_date TEXT NOT NULL,
  meal_slot TEXT NOT NULL,
  food_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS food_log_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  meal_slot TEXT NOT NULL,
  food_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  client_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_macro_targets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  calories INTEGER NOT NULL,
  protein_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
`;

export async function getDb() {
  if (dbInstance) return dbInstance;

  const sqlite = await SQLite.openDatabaseAsync('calorie_tracker.db');
  await sqlite.execAsync(MIGRATION_SQL);

  dbInstance = drizzle(sqlite, {
    schema: {
      localMacroTargets,
      localWeeklyMacroTargets,
      localFoods,
      localMealPlanEntries,
      localFoodLogEntries,
      syncOutbox,
      syncMeta,
    },
  });

  return dbInstance;
}

export {
  localMacroTargets,
  localWeeklyMacroTargets,
  localFoods,
  localMealPlanEntries,
  localFoodLogEntries,
  syncOutbox,
  syncMeta,
};
