import { formatMacroValue } from '@calorie-tracker/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Nutrients = { calories: number; protein: number; fat: number; carbs: number };

type MacroProgressProps = {
  label: string;
  consumed: Nutrients;
  target: Nutrients;
  compact?: boolean;
  className?: string;
};

function ProgressBar({
  label,
  current,
  goal,
  unit = '',
  compact = false,
}: {
  label: string;
  current: number;
  goal: number;
  unit?: string;
  compact?: boolean;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium text-muted-foreground">{label}</span>
          <span className="tabular-nums text-muted-foreground">
            {formatMacroValue(current)}
            {unit}/{formatMacroValue(goal)}
            {unit}
          </span>
        </div>
        <Progress value={pct} className="h-1" />
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">
          {formatMacroValue(current)}
          {unit} / {formatMacroValue(goal)}
          {unit}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function MacroProgress({
  label,
  consumed,
  target,
  compact = false,
  className,
}: MacroProgressProps) {
  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <ProgressBar compact label="Cal" current={consumed.calories} goal={target.calories} />
          <ProgressBar compact label="P" current={consumed.protein} goal={target.protein} unit="g" />
          <ProgressBar compact label="F" current={consumed.fat} goal={target.fat} unit="g" />
          <ProgressBar compact label="C" current={consumed.carbs} goal={target.carbs} unit="g" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <ProgressBar label="Calories" current={consumed.calories} goal={target.calories} />
        <ProgressBar label="Protein" current={consumed.protein} goal={target.protein} unit="g" />
        <ProgressBar label="Fat" current={consumed.fat} goal={target.fat} unit="g" />
        <ProgressBar label="Carbs" current={consumed.carbs} goal={target.carbs} unit="g" />
      </CardContent>
    </Card>
  );
}
