import type { Food } from '@calorie-tracker/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodAmountNutrients } from './NutrientsSummary';
import { cn, inputFieldClass, selectClass } from '@/lib/utils';
import { foodUnitOptions, gramsForAmount, GRAMS_UNIT } from '@/lib/food-units';

type FoodQuantityFieldsProps = {
  food: Food | undefined;
  quantity: string;
  unit: string;
  onQuantityChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  quantityId?: string;
  unitId?: string;
};

export function FoodQuantityFields({
  food,
  quantity,
  unit,
  onQuantityChange,
  onUnitChange,
  quantityId = 'food-quantity',
  unitId = 'food-unit',
}: FoodQuantityFieldsProps) {
  const options = foodUnitOptions(food);
  const selected = options.find((option) => option.value === unit) ?? options[0];
  const amount = Number(quantity);
  const grams = gramsForAmount(food, amount, selected.value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={quantityId} className="text-sm font-medium">
            Amount
          </Label>
          <Input
            id={quantityId}
            placeholder={selected.value === GRAMS_UNIT ? 'e.g. 100' : 'e.g. 1'}
            inputMode="decimal"
            className={cn(inputFieldClass, 'mb-0')}
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={unitId} className="text-sm font-medium">
            Unit
          </Label>
          <select
            id={unitId}
            className={cn(selectClass, 'mb-0 w-full')}
            value={selected.value}
            onChange={(e) => onUnitChange(e.target.value)}
            disabled={!food}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {food && Number.isFinite(amount) && amount > 0 && selected.value !== GRAMS_UNIT && (
        <p className="text-xs text-muted-foreground">
          = {grams.toLocaleString('en-US', { maximumFractionDigits: 1 })}g
        </p>
      )}
      <FoodAmountNutrients
        food={food}
        quantity={quantity}
        unit={selected.value}
        className="text-sm"
      />
    </div>
  );
}
