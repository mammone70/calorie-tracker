import { getClientTimeZone, todayDateString as todayInTimeZone, formatDateInTimeZone } from '@calorie-tracker/shared';

export function todayDateString() {
  return todayInTimeZone(getClientTimeZone());
}

export function formatDate(date: Date) {
  return formatDateInTimeZone(date, getClientTimeZone());
}

export { getClientTimeZone } from '@calorie-tracker/shared';

export function computeNutrients(
  nutrientsPer100g: { calories: number; protein: number; fat: number; carbs: number },
  quantityGrams: number,
) {
  const factor = quantityGrams / 100;
  return {
    calories: Math.round(nutrientsPer100g.calories * factor),
    protein: Math.round(nutrientsPer100g.protein * factor),
    fat: Math.round(nutrientsPer100g.fat * factor),
    carbs: Math.round(nutrientsPer100g.carbs * factor),
  };
}

export function sumNutrients(
  items: Array<{ calories: number; protein: number; fat: number; carbs: number }>,
) {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      fat: acc.fat + item.fat,
      carbs: acc.carbs + item.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
    carbs: Math.round(totals.carbs),
  };
}

const zeroNutrients = { calories: 0, protein: 0, fat: 0, carbs: 0 };

export function quantityToGrams(
  food:
    | {
        servingSizes?: Array<{ label: string; grams: number }> | null;
      }
    | undefined,
  quantity: number,
  unit = 'g',
) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!unit || unit === 'g') return quantity;
  const serving = food?.servingSizes?.find((item) => item.label === unit);
  return serving ? quantity * serving.grams : quantity;
}

export function nutrientsForQuantity(
  food:
    | {
        nutrientsPer100g: { calories: number; protein: number; fat: number; carbs: number };
        servingSizes?: Array<{ label: string; grams: number }> | null;
      }
    | undefined,
  rawQty: string | undefined,
  fallbackQty: number,
  unit = 'g',
) {
  if (!food) return zeroNutrients;
  const qty = Number(rawQty ?? String(fallbackQty));
  if (!Number.isFinite(qty) || qty <= 0) return zeroNutrients;
  return computeNutrients(food.nutrientsPer100g, quantityToGrams(food, qty, unit));
}
