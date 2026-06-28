export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const FOOD_SOURCES = ['user', 'usda', 'open_food_facts'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const SYNC_ENTITY_TYPES = [
  'macro_targets',
  'weekly_macro_targets',
  'foods',
  'meal_plan_entries',
  'food_log_entries',
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
