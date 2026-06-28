import type { WeeklyMeal, DayMeal, WeeklyMealPlanEntry, MealPlanEntry } from '@calorie-tracker/db';
import { normalizeMealTime } from '@calorie-tracker/shared';

export function toIso(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

export function toDateString(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function serializeWeeklyMeal(row: WeeklyMeal) {
  return {
    id: row.id,
    userId: row.userId,
    dayOfWeek: row.dayOfWeek,
    mealIndex: row.mealIndex,
    name: row.name,
    mealTime: normalizeMealTime(row.mealTime),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeDayMeal(row: DayMeal) {
  return {
    id: row.id,
    userId: row.userId,
    planDate: toDateString(row.planDate),
    mealIndex: row.mealIndex,
    name: row.name,
    mealTime: normalizeMealTime(row.mealTime),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeWeeklyMealPlanEntry(row: WeeklyMealPlanEntry) {
  return {
    id: row.id,
    userId: row.userId,
    weeklyMealId: row.weeklyMealId,
    foodId: row.foodId,
    quantity: Number(row.quantity),
    unit: row.unit,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeMealPlanEntry(row: MealPlanEntry) {
  return {
    id: row.id,
    userId: row.userId,
    planDate: toDateString(row.planDate),
    dayMealId: row.dayMealId,
    foodId: row.foodId,
    quantity: Number(row.quantity),
    unit: row.unit,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}
