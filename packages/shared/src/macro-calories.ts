export const PROTEIN_CALORIES_PER_G = 4;
export const CARBS_CALORIES_PER_G = 4;
export const FAT_CALORIES_PER_G = 9;
export const DEFAULT_MACRO_CALORIES_TOLERANCE = 1;

export const MACRO_CALORIES_MISMATCH_MESSAGE =
  'Calories must equal protein×4 + carbs×4 + fat×9 (within 1 cal)';

/** Calories implied by macro grams using 4/4/9 rule. */
export function caloriesFromMacros(proteinG: number, fatG: number, carbsG: number): number {
  return Math.round(
    proteinG * PROTEIN_CALORIES_PER_G +
      carbsG * CARBS_CALORIES_PER_G +
      fatG * FAT_CALORIES_PER_G,
  );
}

export function macrosMatchCalories(
  calories: number,
  proteinG: number,
  fatG: number,
  carbsG: number,
  tolerance = DEFAULT_MACRO_CALORIES_TOLERANCE,
): boolean {
  const computed = caloriesFromMacros(proteinG, fatG, carbsG);
  return Math.abs(computed - Math.round(calories)) <= tolerance;
}

export function macroCaloriesError(
  calories: number,
  proteinG: number,
  fatG: number,
  carbsG: number,
): string | null {
  if (macrosMatchCalories(calories, proteinG, fatG, carbsG)) return null;
  const expected = caloriesFromMacros(proteinG, fatG, carbsG);
  return `${MACRO_CALORIES_MISMATCH_MESSAGE}. Based on your macros, calories should be ${expected}.`;
}

/** Round macro/nutrient values for display (storage may keep decimals). */
export function roundMacroValue(value: number): number {
  return Math.round(value);
}

export function formatMacroValue(value: number): string {
  return String(roundMacroValue(value));
}

export function formatNutrientsSummary(nutrients: {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}): string {
  return `${formatMacroValue(nutrients.calories)} cal · P ${formatMacroValue(nutrients.protein)}g · F ${formatMacroValue(nutrients.fat)}g · C ${formatMacroValue(nutrients.carbs)}g`;
}
