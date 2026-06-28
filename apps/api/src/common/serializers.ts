import type { Nutrients, ServingSize } from '@calorie-tracker/shared';
import type {
  Food,
  MacroTarget,
  FoodLogEntry,
  WeeklyMacroTarget,
} from '@calorie-tracker/db';

export {
  serializeWeeklyMeal,
  serializeDayMeal,
  serializeWeeklyMealPlanEntry,
  serializeMealPlanEntry,
} from './meal-serializers';

export function toIso(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

export function toDateString(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function serializeMacroTarget(row: MacroTarget) {
  return {
    id: row.id,
    userId: row.userId,
    targetDate: toDateString(row.targetDate),
    calories: row.calories,
    proteinG: Number(row.proteinG),
    fatG: Number(row.fatG),
    carbsG: Number(row.carbsG),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeWeeklyMacroTarget(row: WeeklyMacroTarget) {
  return {
    id: row.id,
    userId: row.userId,
    dayOfWeek: row.dayOfWeek,
    calories: row.calories,
    proteinG: Number(row.proteinG),
    fatG: Number(row.fatG),
    carbsG: Number(row.carbsG),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeFood(row: Food) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    brand: row.brand ?? undefined,
    source: row.source,
    externalId: row.externalId ?? undefined,
    nutrientsPer100g: row.nutrientsPer100g as Nutrients,
    servingSizes: (row.servingSizes as ServingSize[] | null) ?? undefined,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}


export function serializeFoodLogEntry(row: FoodLogEntry) {
  return {
    id: row.id,
    userId: row.userId,
    loggedAt: toIso(row.loggedAt)!,
    weeklyMealId: row.weeklyMealId ?? null,
    dayMealId: row.dayMealId ?? null,
    foodId: row.foodId,
    quantity: Number(row.quantity),
    unit: row.unit,
    status: row.status,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function computeNutrients(
  nutrientsPer100g: Nutrients,
  quantityGrams: number,
): Nutrients {
  const factor = quantityGrams / 100;
  return {
    calories: Math.round(nutrientsPer100g.calories * factor),
    protein: Math.round(nutrientsPer100g.protein * factor * 10) / 10,
    fat: Math.round(nutrientsPer100g.fat * factor * 10) / 10,
    carbs: Math.round(nutrientsPer100g.carbs * factor * 10) / 10,
  };
}
