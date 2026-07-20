import { formatMacroValue, formatNutrientsSummary, roundMacroValue } from '@calorie-tracker/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Nutrients = { calories: number; protein: number; fat: number; carbs: number };

type TodayProgressProps = {
  /** Confirmed foods only (eaten). */
  consumed: Nutrients;
  /** All logged foods for the day (pending + confirmed). */
  input: Nutrients;
  target: Nutrients;
  className?: string;
};

function formatCalorieCount(value: number): string {
  return roundMacroValue(value).toLocaleString('en-US');
}

function MacroColumn({
  label,
  consumed,
  input,
  goal,
}: {
  label: string;
  consumed: number;
  input: number;
  goal: number;
}) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm tabular-nums">
        <span className="font-semibold text-foreground">{formatMacroValue(consumed)} g</span>
        <span className="text-muted-foreground"> / {formatMacroValue(goal)}</span>
      </p>
      <p className="truncate text-[11px] tabular-nums text-muted-foreground">
        Input {formatMacroValue(input)} g
      </p>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function TodayProgress({ consumed, input, target, className }: TodayProgressProps) {
  const calPct =
    target.calories > 0 ? Math.min((consumed.calories / target.calories) * 100, 100) : 0;
  const remaining = Math.max(0, target.calories - consumed.calories);

  return (
    <div className={cn('space-y-2', className)}>
      <Card>
        <CardContent className="space-y-2 p-3">
          <p className="text-xs text-muted-foreground">Calories</p>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate tabular-nums">
              <span className="text-xl font-bold text-foreground">
                {formatCalorieCount(consumed.calories)} cal
              </span>
              <span className="text-sm text-muted-foreground">
                {' '}
                / {formatCalorieCount(target.calories)}
              </span>
            </p>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {formatCalorieCount(remaining)} left
            </p>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            Input {formatCalorieCount(input.calories)} cal
            {input.calories !== consumed.calories
              ? ` · ${formatCalorieCount(Math.max(0, input.calories - consumed.calories))} unconfirmed`
              : ''}
          </p>
          <Progress value={calPct} className="h-2.5" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-3">
          <div className="flex gap-3">
            <MacroColumn
              label="Carbs"
              consumed={consumed.carbs}
              input={input.carbs}
              goal={target.carbs}
            />
            <MacroColumn
              label="Fat"
              consumed={consumed.fat}
              input={input.fat}
              goal={target.fat}
            />
            <MacroColumn
              label="Protein"
              consumed={consumed.protein}
              input={input.protein}
              goal={target.protein}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Consumed = confirmed. Input = all foods in today’s meals.
          </p>
          <p className="sr-only">{formatNutrientsSummary(input)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
