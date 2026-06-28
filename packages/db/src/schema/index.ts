import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  smallint,
} from 'drizzle-orm/pg-core';

export const mealSlotEnum = pgEnum('meal_slot', [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]);

export const foodSourceEnum = pgEnum('food_source', [
  'user',
  'usda',
  'open_food_facts',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const macroTargets = pgTable(
  'macro_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetDate: date('target_date').notNull(),
    calories: integer('calories').notNull(),
    proteinG: numeric('protein_g', { precision: 8, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 8, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('macro_targets_user_date_idx').on(table.userId, table.targetDate),
  ],
);

export const weeklyMacroTargets = pgTable(
  'weekly_macro_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    calories: integer('calories').notNull(),
    proteinG: numeric('protein_g', { precision: 8, scale: 2 }).notNull(),
    fatG: numeric('fat_g', { precision: 8, scale: 2 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('weekly_macro_targets_user_dow_idx').on(table.userId, table.dayOfWeek),
  ],
);

export const foods = pgTable('foods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  source: foodSourceEnum('source').notNull().default('user'),
  externalId: text('external_id'),
  nutrientsPer100g: jsonb('nutrients_per_100g').notNull(),
  servingSizes: jsonb('serving_sizes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planDate: date('plan_date').notNull(),
  mealSlot: mealSlotEnum('meal_slot').notNull(),
  foodId: uuid('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit').notNull().default('g'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const foodLogEntries = pgTable('food_log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
  mealSlot: mealSlotEnum('meal_slot').notNull(),
  foodId: uuid('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit').notNull().default('g'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type MacroTarget = typeof macroTargets.$inferSelect;
export type WeeklyMacroTarget = typeof weeklyMacroTargets.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type FoodLogEntry = typeof foodLogEntries.$inferSelect;

export const schema = {
  users,
  refreshTokens,
  macroTargets,
  weeklyMacroTargets,
  foods,
  mealPlanEntries,
  foodLogEntries,
};
