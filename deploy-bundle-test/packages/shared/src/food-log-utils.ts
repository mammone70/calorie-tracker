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

/** Store meal time on the plan date in UTC so findByDate (UTC day bounds) stays consistent. */
export function loggedAtForDate(date: string, mealTime?: string | null): string {
  const time = mealTime ?? '12:00';
  return `${date}T${time}:00.000Z`;
}
export function confirmedFoodLogs(logs: FoodLogEntry[]): FoodLogEntry[] {
  return logs.filter((log) => !log.deletedAt && log.status === 'confirmed');
}
