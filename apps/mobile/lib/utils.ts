import Constants from 'expo-constants';

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'http://10.0.2.2:3000/api';

export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function computeNutrients(
  nutrientsPer100g: { calories: number; protein: number; fat: number; carbs: number },
  quantityGrams: number,
) {
  const factor = quantityGrams / 100;
  return {
    calories: Math.round(nutrientsPer100g.calories * factor),
    protein: Math.round(nutrientsPer100g.protein * factor * 10) / 10,
    fat: Math.round(nutrientsPer100g.fat * factor * 10) / 10,
    carbs: Math.round(nutrientsPer100g.carbs * factor * 10) / 10,
  };
}

export function sumNutrients(
  items: Array<{ calories: number; protein: number; fat: number; carbs: number }>,
) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      fat: acc.fat + item.fat,
      carbs: acc.carbs + item.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}
