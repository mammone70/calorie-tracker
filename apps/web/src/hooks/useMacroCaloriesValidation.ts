import { useMemo } from 'react';
import { caloriesFromMacros, macrosMatchCalories, roundMacroValue } from '@calorie-tracker/shared';

export type MacroCaloriesFieldValues = {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
};

export type MacroCaloriesValidation = {
  show: boolean;
  isValid: boolean;
  computedCalories: number;
  enteredCalories: number;
  message: string | null;
};

export function getMacroCaloriesValidation(
  fields: MacroCaloriesFieldValues,
): MacroCaloriesValidation {
  const hasAny = [fields.calories, fields.protein, fields.fat, fields.carbs].some(
    (value) => value.trim() !== '',
  );

  if (!hasAny) {
    return {
      show: false,
      isValid: true,
      computedCalories: 0,
      enteredCalories: 0,
      message: null,
    };
  }

  const enteredCalories = Number(fields.calories) || 0;
  const proteinG = Number(fields.protein) || 0;
  const fatG = Number(fields.fat) || 0;
  const carbsG = Number(fields.carbs) || 0;
  const computedCalories = caloriesFromMacros(proteinG, fatG, carbsG);
  const isValid = macrosMatchCalories(enteredCalories, proteinG, fatG, carbsG);

  if (isValid) {
    return {
      show: true,
      isValid: true,
      computedCalories,
      enteredCalories,
      message: `Calories match macros (${computedCalories} cal)`,
    };
  }

  const diff = roundMacroValue(enteredCalories) - computedCalories;
  const diffLabel =
    diff > 0 ? `${diff} cal over` : diff < 0 ? `${Math.abs(diff)} cal under` : 'mismatch';

  return {
    show: true,
    isValid: false,
    computedCalories,
    enteredCalories: roundMacroValue(enteredCalories),
    message: `Macros add up to ${computedCalories} cal — entered ${roundMacroValue(enteredCalories)} cal (${diffLabel})`,
  };
}

export function useMacroCaloriesValidation(fields: MacroCaloriesFieldValues) {
  return useMemo(
    () => getMacroCaloriesValidation(fields),
    [fields.calories, fields.protein, fields.fat, fields.carbs],
  );
}

export function macroFormHasValues(fields: MacroCaloriesFieldValues) {
  return [fields.calories, fields.protein, fields.fat, fields.carbs].some(
    (value) => value.trim() !== '',
  );
}
