import { sql } from 'drizzle-orm';
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

export const foodLogStatusEnum = pgEnum('food_log_status', ['pending', 'confirmed']);

export const foodSourceEnum = pgEnum('food_source', [
  'user',
  'usda',
  'open_food_facts',
]);

export const userRoleEnum = pgEnum('user_role', ['client', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

export const weeklyMeals = pgTable(
  'weekly_meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(),
    mealIndex: smallint('meal_index').notNull(),
    name: text('name').notNull(),
    mealTime: text('meal_time'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('weekly_meals_user_dow_index_idx')
      .on(table.userId, table.dayOfWeek, table.mealIndex)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const weeklyMealPlanEntries = pgTable('weekly_meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weeklyMealId: uuid('weekly_meal_id')
    .notNull()
    .references(() => weeklyMeals.id, { onDelete: 'cascade' }),
  foodId: uuid('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit').notNull().default('g'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const dayMeals = pgTable(
  'day_meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planDate: date('plan_date').notNull(),
    mealIndex: smallint('meal_index').notNull(),
    name: text('name').notNull(),
    mealTime: text('meal_time'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('day_meals_user_date_index_idx')
      .on(table.userId, table.planDate, table.mealIndex)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planDate: date('plan_date').notNull(),
  dayMealId: uuid('day_meal_id')
    .notNull()
    .references(() => dayMeals.id, { onDelete: 'cascade' }),
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
  weeklyMealId: uuid('weekly_meal_id').references(() => weeklyMeals.id, { onDelete: 'set null' }),
  dayMealId: uuid('day_meal_id').references(() => dayMeals.id, { onDelete: 'set null' }),
  foodId: uuid('food_id')
    .notNull()
    .references(() => foods.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit').notNull().default('g'),
  status: foodLogStatusEnum('status').notNull().default('confirmed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const dailyLogMaterializations = pgTable(
  'daily_log_materializations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planDate: date('plan_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('daily_log_materializations_user_date_idx').on(table.userId, table.planDate),
  ],
);

export type User = typeof users.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type MacroTarget = typeof macroTargets.$inferSelect;
export type WeeklyMacroTarget = typeof weeklyMacroTargets.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type WeeklyMeal = typeof weeklyMeals.$inferSelect;
export type WeeklyMealPlanEntry = typeof weeklyMealPlanEntries.$inferSelect;
export type DayMeal = typeof dayMeals.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type FoodLogEntry = typeof foodLogEntries.$inferSelect;
export type DailyLogMaterialization = typeof dailyLogMaterializations.$inferSelect;

export const schema = {
  users,
  invitations,
  refreshTokens,
  macroTargets,
  weeklyMacroTargets,
  weeklyMeals,
  weeklyMealPlanEntries,
  dayMeals,
  foods,
  mealPlanEntries,
  foodLogEntries,
  dailyLogMaterializations,
};
