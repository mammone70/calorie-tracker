import type { DayMeal } from './schemas/day-meal';
import type { MealPlanEntry } from './schemas/meal-plan';
import type {
  EffectiveMealBlock,
  EffectiveMealPlan,
  WeeklyMealPlanEntry,
} from './schemas/weekly-meal-plan';
import type { WeeklyMeal } from './schemas/weekly-meal';
import { dayOfWeekFromDate } from './macro-target-utils';

type MealDefinition = {
  id: string;
  mealIndex: number;
  name: string;
  mealTime: string | null;
};

function buildMealBlocks(
  meals: MealDefinition[],
  entries: Array<{ id: string; mealId: string; foodId: string; quantity: number; unit: string }>,
  source: 'override' | 'weekly',
): EffectiveMealBlock[] {
  const sortedMeals = [...meals].sort((a, b) => a.mealIndex - b.mealIndex);
  const entriesByMeal = new Map<string, EffectiveMealBlock['entries']>();

  for (const entry of entries) {
    const list = entriesByMeal.get(entry.mealId) ?? [];
    list.push({
      id: entry.id,
      foodId: entry.foodId,
      quantity: entry.quantity,
      unit: entry.unit,
    });
    entriesByMeal.set(entry.mealId, list);
  }

  return sortedMeals.map((meal) => ({
    id: meal.id,
    mealIndex: meal.mealIndex,
    name: meal.name,
    mealTime: meal.mealTime,
    source,
    entries: entriesByMeal.get(meal.id) ?? [],
  }));
}

export function resolveEffectiveMealPlan(
  date: string,
  dayMeals: DayMeal[],
  dateEntries: MealPlanEntry[],
  weeklyMeals: WeeklyMeal[],
  weeklyEntries: WeeklyMealPlanEntry[],
): EffectiveMealPlan {
  const activeDayMeals = dayMeals.filter((meal) => !meal.deletedAt);
  const activeDateEntries = dateEntries.filter((entry) => !entry.deletedAt);

  if (activeDayMeals.length > 0 || activeDateEntries.length > 0) {
    return {
      source: 'override',
      meals: buildMealBlocks(
        activeDayMeals.map((meal) => ({
          id: meal.id,
          mealIndex: meal.mealIndex,
          name: meal.name,
          mealTime: meal.mealTime ?? null,
        })),
        activeDateEntries.map((entry) => ({
          id: entry.id,
          mealId: entry.dayMealId,
          foodId: entry.foodId,
          quantity: entry.quantity,
          unit: entry.unit,
        })),
        'override',
      ),
    };
  }

  const dayOfWeek = dayOfWeekFromDate(date);
  const templateMeals = weeklyMeals.filter(
    (meal) => meal.dayOfWeek === dayOfWeek && !meal.deletedAt,
  );
  const templateEntries = weeklyEntries.filter((entry) => !entry.deletedAt);

  if (templateMeals.length === 0 && templateEntries.length === 0) {
    return { source: 'none', meals: [] };
  }

  return {
    source: 'weekly',
    meals: buildMealBlocks(
      templateMeals.map((meal) => ({
        id: meal.id,
        mealIndex: meal.mealIndex,
        name: meal.name,
        mealTime: meal.mealTime ?? null,
      })),
      templateEntries.map((entry) => ({
        id: entry.id,
        mealId: entry.weeklyMealId,
        foodId: entry.foodId,
        quantity: entry.quantity,
        unit: entry.unit,
      })),
      'weekly',
    ),
  };
}

export const DEFAULT_MEAL_NAMES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Meal 5',
  'Meal 6',
  'Meal 7',
  'Meal 8',
  'Meal 9',
  'Meal 10',
] as const;

export function defaultMealName(mealIndex: number): string {
  return DEFAULT_MEAL_NAMES[mealIndex] ?? `Meal ${mealIndex + 1}`;
}

export function normalizeMealTime(mealTime: string | null | undefined): string | null {
  if (!mealTime) return null;
  return mealTime.slice(0, 5);
}

/** Display meal time in 12-hour AM/PM (storage remains 24-hour HH:MM). */
export function formatMealTime(mealTime: string | null | undefined): string | null {
  const normalized = normalizeMealTime(mealTime);
  if (!normalized) return null;

  const [hourStr, minuteStr] = normalized.split(':');
  const hour = Number(hourStr);
  if (Number.isNaN(hour)) return normalized;

  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteStr} ${period}`;
}
