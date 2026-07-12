import { useMemo, useState } from 'react';
import {
  formatNutrientsSummary,
  macroCaloriesError,
  roundMacroValue,
  type Nutrients,
  type ServingSize,
} from '@calorie-tracker/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MacroCaloriesFeedback, MacroCaloriesInput } from './MacroCaloriesFeedback';
import { useMacroCaloriesValidation } from '../hooks/useMacroCaloriesValidation';
import { cn, inputFieldClass, selectClass } from '@/lib/utils';

const PER_100G = '100g';

export type FoodFormValues = {
  name: string;
  brand?: string;
  nutrientsPer100g: Nutrients;
  servingSizes: ServingSize[];
};

type FoodFormProps = {
  initial?: Partial<FoodFormValues>;
  submitLabel: string;
  onSubmit: (values: FoodFormValues) => Promise<void>;
};

type DraftServing = {
  key: string;
  label: string;
  grams: string;
};

function scaleNutrients(nutrients: Nutrients, factor: number): Nutrients {
  return {
    calories: roundMacroValue(nutrients.calories * factor),
    protein: Number((nutrients.protein * factor).toFixed(2)),
    fat: Number((nutrients.fat * factor).toFixed(2)),
    carbs: Number((nutrients.carbs * factor).toFixed(2)),
  };
}

function nutrientsToStrings(nutrients: Nutrients) {
  return {
    calories: String(roundMacroValue(nutrients.calories)),
    protein: String(nutrients.protein),
    fat: String(nutrients.fat),
    carbs: String(nutrients.carbs),
  };
}

function parseServingDrafts(servings: ServingSize[]): DraftServing[] {
  return servings.map((serving, index) => ({
    key: `${serving.label}-${serving.grams}-${index}`,
    label: serving.label,
    grams: String(serving.grams),
  }));
}

export function FoodForm({ initial, submitLabel, onSubmit }: FoodFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [servings, setServings] = useState<DraftServing[]>(() =>
    parseServingDrafts(initial?.servingSizes ?? []),
  );
  const [basisKey, setBasisKey] = useState(PER_100G);
  const [calories, setCalories] = useState(() =>
    initial?.nutrientsPer100g ? String(roundMacroValue(initial.nutrientsPer100g.calories)) : '',
  );
  const [protein, setProtein] = useState(() =>
    initial?.nutrientsPer100g ? String(initial.nutrientsPer100g.protein) : '',
  );
  const [fat, setFat] = useState(() =>
    initial?.nutrientsPer100g ? String(initial.nutrientsPer100g.fat) : '',
  );
  const [carbs, setCarbs] = useState(() =>
    initial?.nutrientsPer100g ? String(initial.nutrientsPer100g.carbs) : '',
  );
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const macroValidation = useMacroCaloriesValidation({ calories, protein, fat, carbs });
  const macroFieldsInvalid = macroValidation.show && !macroValidation.isValid;

  const parsedServings = useMemo(() => {
    return servings
      .map((serving) => {
        const grams = Number(serving.grams);
        if (!serving.label.trim() || !Number.isFinite(grams) || grams <= 0) return null;
        return { key: serving.key, label: serving.label.trim(), grams };
      })
      .filter((serving): serving is ServingSize & { key: string } => serving !== null);
  }, [servings]);

  const basisGrams =
    basisKey === PER_100G
      ? 100
      : (parsedServings.find((serving) => serving.key === basisKey)?.grams ?? 100);

  const nutrientsPer100gFromForm = (): Nutrients => {
    const entered: Nutrients = {
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
    };
    return scaleNutrients(entered, 100 / basisGrams);
  };

  const switchBasis = (nextKey: string) => {
    if (nextKey === basisKey) return;
    const nextGrams =
      nextKey === PER_100G
        ? 100
        : (parsedServings.find((serving) => serving.key === nextKey)?.grams ?? null);
    if (nextGrams == null || nextGrams <= 0) return;

    const per100g = nutrientsPer100gFromForm();
    const forBasis = scaleNutrients(per100g, nextGrams / 100);
    const strings = nutrientsToStrings(forBasis);
    setCalories(strings.calories === '0' && !calories ? '' : strings.calories);
    setProtein(strings.protein === '0' && !protein ? '' : strings.protein);
    setFat(strings.fat === '0' && !fat ? '' : strings.fat);
    setCarbs(strings.carbs === '0' && !carbs ? '' : strings.carbs);
    setBasisKey(nextKey);
  };

  const addServing = () => {
    setServings((prev) => [
      ...prev,
      { key: crypto.randomUUID(), label: '', grams: '' },
    ]);
  };

  const updateServing = (key: string, patch: Partial<DraftServing>) => {
    setServings((prev) =>
      prev.map((serving) => (serving.key === key ? { ...serving, ...patch } : serving)),
    );
  };

  const removeServing = (key: string) => {
    setServings((prev) => prev.filter((serving) => serving.key !== key));
    if (basisKey === key) {
      const per100g = nutrientsPer100gFromForm();
      const strings = nutrientsToStrings(per100g);
      setCalories(strings.calories);
      setProtein(strings.protein);
      setFat(strings.fat);
      setCarbs(strings.carbs);
      setBasisKey(PER_100G);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setMessage('Food name is required');
      setMessageIsError(true);
      return;
    }

    for (const serving of servings) {
      if (!serving.label.trim() && !serving.grams.trim()) continue;
      const grams = Number(serving.grams);
      if (!serving.label.trim() || !Number.isFinite(grams) || grams <= 0) {
        setMessage('Each unit needs a label and a positive weight in grams');
        setMessageIsError(true);
        return;
      }
    }

    const nutrientsPer100g = nutrientsPer100gFromForm();
    const validationError = macroCaloriesError(
      nutrientsPer100g.calories,
      nutrientsPer100g.protein,
      nutrientsPer100g.fat,
      nutrientsPer100g.carbs,
    );
    if (validationError) {
      setMessage(validationError);
      setMessageIsError(true);
      return;
    }

    setSaving(true);
    setMessage('');
    setMessageIsError(false);
    try {
      await onSubmit({
        name: name.trim(),
        brand: brand.trim() || undefined,
        nutrientsPer100g,
        servingSizes: parsedServings.map(({ label, grams }) => ({ label, grams })),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save');
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const previewPer100g = nutrientsPer100gFromForm();

  return (
    <div className="space-y-4">
      {message && (
        <p className={cn('text-sm', messageIsError ? 'text-destructive' : 'text-primary')}>
          {message}
        </p>
      )}

      <div className="space-y-3">
        <Input placeholder="Food name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Brand (optional)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Units of measurement</Label>
          <Button type="button" variant="outline" size="sm" onClick={addServing}>
            Add unit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Define custom units (e.g. scoop, cup) and how many grams each is. Nutrition is always
          stored per 100g and converted from the unit you enter below.
        </p>
        {servings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom units yet — default is 100g.</p>
        ) : (
          <ul className="space-y-2">
            {servings.map((serving) => (
              <li key={serving.key} className="flex items-center gap-2">
                <Input
                  className={cn(inputFieldClass, 'flex-1')}
                  placeholder="Unit label"
                  value={serving.label}
                  onChange={(e) => updateServing(serving.key, { label: e.target.value })}
                />
                <Input
                  className={cn(inputFieldClass, 'w-24')}
                  placeholder="g"
                  inputMode="decimal"
                  value={serving.grams}
                  onChange={(e) => updateServing(serving.key, { grams: e.target.value })}
                />
                <span className="shrink-0 text-xs text-muted-foreground">g</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeServing(serving.key)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="nutrient-basis" className="text-sm font-medium">
            Enter nutrition for
          </Label>
          <select
            id="nutrient-basis"
            className={cn(selectClass, 'mb-0 w-full appearance-auto')}
            value={basisKey}
            onChange={(e) => switchBasis(e.target.value)}
          >
            <option value={PER_100G}>Per 100g</option>
            {parsedServings.map((serving) => (
              <option key={serving.key} value={serving.key}>
                Per {serving.label} ({serving.grams}g)
              </option>
            ))}
          </select>
        </div>

        <MacroCaloriesInput
          value={calories}
          onChange={setCalories}
          placeholder="Calories"
          invalid={macroFieldsInvalid}
        />
        <MacroCaloriesInput
          value={protein}
          onChange={setProtein}
          placeholder="Protein (g)"
          invalid={macroFieldsInvalid}
        />
        <MacroCaloriesInput
          value={fat}
          onChange={setFat}
          placeholder="Fat (g)"
          invalid={macroFieldsInvalid}
        />
        <MacroCaloriesInput
          value={carbs}
          onChange={setCarbs}
          placeholder="Carbs (g)"
          invalid={macroFieldsInvalid}
        />
        <MacroCaloriesFeedback validation={macroValidation} />
      </div>

      {(parsedServings.length > 0 || calories || protein || fat || carbs) && (
        <div className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Nutrition preview</p>
          <p>{formatNutrientsSummary(previewPer100g)} (per 100g)</p>
          {parsedServings.map((serving) => (
            <p key={serving.key}>
              {formatNutrientsSummary(scaleNutrients(previewPer100g, serving.grams / 100))} (per{' '}
              {serving.label})
            </p>
          ))}
        </div>
      )}

      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={() => void handleSubmit()}
        disabled={macroFieldsInvalid || saving}
      >
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}
