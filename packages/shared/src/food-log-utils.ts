import { resolveTimeZone, zonedDateTimeToUtc } from './date-utils';
import type { EffectiveMealBlock } from './schemas/weekly-meal-plan';
import type { FoodLogEntry } from './schemas/food-log';

export type GroupedFoodLogMeal = EffectiveMealBlock & {
  logs: FoodLogEntry[];
};

export function mealRefFromEffectiveMeal(meal: EffectiveMealBlock): {
  weeklyMealId?: string;
  dayMealId?: string;
} {
  if (meal.source === 'weekly') {
    return { weeklyMealId: meal.id };
  }
  return { dayMealId: meal.id };
}

export function groupFoodLogsByMeal(
  effectiveMeals: EffectiveMealBlock[],
  logs: FoodLogEntry[],
): GroupedFoodLogMeal[] {
  const activeLogs = logs.filter((log) => !log.deletedAt);

  return effectiveMeals.map((meal) => ({
    ...meal,
    logs: activeLogs.filter((log) =>
      meal.source === 'weekly'
        ? log.weeklyMealId === meal.id
        : log.dayMealId === meal.id,
    ),
  }));
}

export function ungroupedFoodLogs(
  effectiveMeals: EffectiveMealBlock[],
  logs: FoodLogEntry[],
): FoodLogEntry[] {
  const groupedIds = new Set(
    groupFoodLogsByMeal(effectiveMeals, logs).flatMap((meal) => meal.logs.map((log) => log.id)),
  );
  return logs.filter((log) => !log.deletedAt && !groupedIds.has(log.id));
}

/** Store meal time on the plan date in the user's local timezone. */
export function loggedAtForDate(
  date: string,
  mealTime?: string | null,
  timeZone?: string,
): string {
  const time = mealTime && /^\d{2}:\d{2}$/.test(mealTime) ? mealTime : '12:00';
  return zonedDateTimeToUtc(date, `${time}:00`, resolveTimeZone(timeZone)).toISOString();
}

export function confirmedFoodLogs(logs: FoodLogEntry[]): FoodLogEntry[] {  return logs.filter((log) => !log.deletedAt && log.status === 'confirmed');
}
