export const FOOD_LOG_STATUSES = ['pending', 'confirmed'] as const;
export type FoodLogStatus = (typeof FOOD_LOG_STATUSES)[number];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const MIN_MEALS_PER_DAY = 1;
export const MAX_MEALS_PER_DAY = 10;
export const DEFAULT_MEAL_COUNT = 3;

export const FOOD_SOURCES = ['user', 'usda', 'open_food_facts'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const WORKOUT_SCHEDULE_KINDS = ['weekday', 'interval'] as const;
export type WorkoutScheduleKind = (typeof WORKOUT_SCHEDULE_KINDS)[number];

export const WORKOUT_SET_STATUSES = ['pending', 'confirmed'] as const;
export type WorkoutSetStatus = (typeof WORKOUT_SET_STATUSES)[number];

export const WEIGHT_UNITS = ['lbs', 'kg'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lbs';

export const PRESCRIPTION_KINDS = ['none', 'rpe', 'rir', 'load_increase'] as const;
export type PrescriptionKind = (typeof PRESCRIPTION_KINDS)[number];

export const SYNC_ENTITY_TYPES = [
  'macro_targets',
  'weekly_macro_targets',
  'weekly_meals',
  'weekly_meal_plan_entries',
  'day_meals',
  'foods',
  'meal_plan_entries',
  'food_log_entries',
  'exercises',
  'workout_set_logs',
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
