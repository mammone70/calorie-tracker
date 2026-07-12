import type { Food, ServingSize } from '@calorie-tracker/shared';

export const GRAMS_UNIT = 'g';

export type FoodUnitOption = {
  value: string;
  label: string;
  gramsPerUnit: number;
};

export function foodUnitOptions(food: Food | undefined): FoodUnitOption[] {
  const servings = (food?.servingSizes ?? []).filter(
    (serving): serving is ServingSize =>
      !!serving.label?.trim() && Number.isFinite(serving.grams) && serving.grams > 0,
  );

  return [
    { value: GRAMS_UNIT, label: 'grams (g)', gramsPerUnit: 1 },
    ...servings.map((serving) => ({
      value: serving.label,
      label: `${serving.label} (${serving.grams}g)`,
      gramsPerUnit: serving.grams,
    })),
  ];
}

export function gramsForAmount(
  food: Food | undefined,
  amount: number,
  unit: string,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === GRAMS_UNIT || !unit) return amount;
  const option = foodUnitOptions(food).find((item) => item.value === unit);
  return amount * (option?.gramsPerUnit ?? 1);
}
