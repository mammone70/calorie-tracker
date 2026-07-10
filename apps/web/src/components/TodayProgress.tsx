import { formatMacroValue, roundMacroValue } from '@calorie-tracker/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Nutrients = { calories: number; protein: number; fat: number; carbs: number };

type TodayProgressProps = {
  consumed: Nutrients;
  target: Nutrients;
  className?: string;
};

function formatCalorieCount(value: number): string {
  return roundMacroValue(value).toLocaleString('en-US');
}

function MacroColumn({
  label,
  current,
  goal,
}: {
  label: string;
  current: number;
  goal: number;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm tabular-nums">
        <span className="font-semibold text-foreground">
          {formatMacroValue(current)} g
        </span>
        <span className="text-muted-foreground"> / {formatMacroValue(goal)}</span>
      </p>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function TodayProgress({ consumed, target, className }: TodayProgressProps) {
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
          <Progress value={calPct} className="h-2.5" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-3">
            <MacroColumn label="Carbs" current={consumed.carbs} goal={target.carbs} />
            <MacroColumn label="Fat" current={consumed.fat} goal={target.fat} />
            <MacroColumn label="Protein" current={consumed.protein} goal={target.protein} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
