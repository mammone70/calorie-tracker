import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const localMacroTargets = sqliteTable('macro_targets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  targetDate: text('target_date').notNull(),
  calories: integer('calories').notNull(),
  proteinG: real('protein_g').notNull(),
  fatG: real('fat_g').notNull(),
  carbsG: real('carbs_g').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const localFoods = sqliteTable('foods', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  source: text('source').notNull(),
  externalId: text('external_id'),
  nutrientsPer100g: text('nutrients_per_100g').notNull(),
  servingSizes: text('serving_sizes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const localMealPlanEntries = sqliteTable('meal_plan_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  planDate: text('plan_date').notNull(),
  mealSlot: text('meal_slot').notNull(),
  foodId: text('food_id').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const localFoodLogEntries = sqliteTable('food_log_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  loggedAt: text('logged_at').notNull(),
  mealSlot: text('meal_slot').notNull(),
  foodId: text('food_id').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const syncOutbox = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload'),
  clientUpdatedAt: text('client_updated_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
