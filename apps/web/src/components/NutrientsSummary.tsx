import { nutrientsForQuantity } from '@calorie-tracker/client';
import type { Food } from '@calorie-tracker/shared';
import { formatNutrientsSummary } from '@calorie-tracker/shared';
import { cn } from '@/lib/utils';

type NutrientsSummaryProps = {
  nutrients: { calories: number; protein: number; fat: number; carbs: number };
  className?: string;
};

export function NutrientsSummary({ nutrients, className }: NutrientsSummaryProps) {
  return (
    <p className={cn('text-xs tabular-nums text-muted-foreground', className)}>
      {formatNutrientsSummary(nutrients)}
    </p>
  );
}

type FoodAmountNutrientsProps = {
  food: Food | undefined;
  quantity: string;
  unit?: string;
  className?: string;
};

export function FoodAmountNutrients({
  food,
  quantity,
  unit = 'g',
  className,
}: FoodAmountNutrientsProps) {
  if (!food) return null;

  return (
    <NutrientsSummary
      nutrients={nutrientsForQuantity(food, quantity, 100, unit)}
      className={className}
    />
  );
}
