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
  boolean,
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

export const workoutScheduleKindEnum = pgEnum('workout_schedule_kind', ['weekday', 'interval']);

export const workoutSetStatusEnum = pgEnum('workout_set_status', ['pending', 'confirmed']);

export const weightUnitEnum = pgEnum('weight_unit', ['lbs', 'kg']);

export const prescriptionKindEnum = pgEnum('prescription_kind', [
  'none',
  'rpe',
  'rir',
  'load_increase',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  weightUnit: weightUnitEnum('weight_unit').notNull().default('lbs'),
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
  trusted: boolean('trusted').notNull().default(false),
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

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    notes: text('notes'),
    isGlobal: boolean('is_global').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exercises_global_name_active_idx')
      .on(table.name)
      .where(sql`is_global = true AND deleted_at IS NULL`),
    uniqueIndex('exercises_user_name_active_idx')
      .on(table.userId, table.name)
      .where(sql`is_global = false AND deleted_at IS NULL`),
  ],
);

export const workoutTemplates = pgTable('workout_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  scheduleKind: workoutScheduleKindEnum('schedule_kind').notNull(),
  dayOfWeek: smallint('day_of_week'),
  intervalDays: integer('interval_days'),
  anchorDate: date('anchor_date'),
  sortIndex: smallint('sort_index').notNull().default(0),
  isActive: smallint('is_active').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const workoutTemplateExercises = pgTable('workout_template_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id')
    .notNull()
    .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }),
  bodyPart: text('body_part'),
  weekIndex: smallint('week_index').notNull().default(1),
  sortIndex: smallint('sort_index').notNull().default(0),
  targetSets: smallint('target_sets'),
  repsMin: integer('reps_min'),
  repsMax: integer('reps_max'),
  targetWeight: numeric('target_weight', { precision: 10, scale: 2 }),
  prescriptionKind: prescriptionKindEnum('prescription_kind').notNull().default('none'),
  prescriptionValue: numeric('prescription_value', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const workoutBlocks = pgTable('workout_blocks', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  startDate: date('start_date'),
  weekCount: smallint('week_count').notNull().default(3),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dayWorkoutSessions = pgTable(
  'day_workout_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionDate: date('session_date').notNull(),
    name: text('name').notNull(),
    sortIndex: smallint('sort_index').notNull().default(0),
    sourceTemplateId: uuid('source_template_id').references(() => workoutTemplates.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('day_workout_sessions_user_date_sort_idx')
      .on(table.userId, table.sessionDate, table.sortIndex)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const dayWorkoutExercises = pgTable('day_workout_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dayWorkoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }),
  bodyPart: text('body_part'),
  weekIndex: smallint('week_index').notNull().default(1),
  sortIndex: smallint('sort_index').notNull().default(0),
  targetSets: smallint('target_sets'),
  repsMin: integer('reps_min'),
  repsMax: integer('reps_max'),
  targetWeight: numeric('target_weight', { precision: 10, scale: 2 }),
  prescriptionKind: prescriptionKindEnum('prescription_kind').notNull().default('none'),
  prescriptionValue: numeric('prescription_value', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const workoutSetLogs = pgTable('workout_set_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dayExerciseId: uuid('day_exercise_id')
    .notNull()
    .references(() => dayWorkoutExercises.id, { onDelete: 'cascade' }),
  setIndex: smallint('set_index').notNull(),
  status: workoutSetStatusEnum('status').notNull().default('pending'),
  targetRepsMin: integer('target_reps_min').notNull(),
  targetRepsMax: integer('target_reps_max').notNull(),
  targetWeight: numeric('target_weight', { precision: 10, scale: 2 }),
  actualReps: integer('actual_reps'),
  actualWeight: numeric('actual_weight', { precision: 10, scale: 2 }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const dailyWorkoutMaterializations = pgTable(
  'daily_workout_materializations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionDate: date('session_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('daily_workout_materializations_user_date_idx').on(
      table.userId,
      table.sessionDate,
    ),
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
export type Exercise = typeof exercises.$inferSelect;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type WorkoutTemplateExercise = typeof workoutTemplateExercises.$inferSelect;
export type WorkoutBlock = typeof workoutBlocks.$inferSelect;
export type DayWorkoutSession = typeof dayWorkoutSessions.$inferSelect;
export type DayWorkoutExercise = typeof dayWorkoutExercises.$inferSelect;
export type WorkoutSetLog = typeof workoutSetLogs.$inferSelect;
export type DailyWorkoutMaterialization = typeof dailyWorkoutMaterializations.$inferSelect;

export const bodyWeightLogs = pgTable(
  'body_weight_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedOn: date('logged_on').notNull(),
    weight: numeric('weight', { precision: 8, scale: 2 }).notNull(),
    unit: weightUnitEnum('unit').notNull().default('lbs'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('body_weight_logs_user_day_active_idx')
      .on(table.userId, table.loggedOn)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type BodyWeightLog = typeof bodyWeightLogs.$inferSelect;

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
  exercises,
  workoutTemplates,
  workoutTemplateExercises,
  workoutBlocks,
  dayWorkoutSessions,
  dayWorkoutExercises,
  workoutSetLogs,
  dailyWorkoutMaterializations,
  bodyWeightLogs,
};
