import { formatMacroValue } from '@calorie-tracker/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type MacroProgressProps = {
  label: string;
  consumed: { calories: number; protein: number; fat: number; carbs: number };
  target: { calories: number; protein: number; fat: number; carbs: number };
};

function ProgressBar({
  label,
  current,
  goal,
  unit = '',
}: {
  label: string;
  current: number;
  goal: number;
  unit?: string;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
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

export function MacroProgress({ label, consumed, target }: MacroProgressProps) {
  return (
    <Card className="w-full">
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
