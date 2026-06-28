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
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex justify-between">
        <span className="font-semibold text-foreground-secondary">{label}</span>
        <span className="text-sm text-muted">
          {Math.round(current)}
          {unit} / {Math.round(goal)}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-track">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export function MacroProgress({ label, consumed, target }: MacroProgressProps) {
  return (
    <div className="card mx-4">
      <h2 className="mb-4 text-lg font-bold">{label}</h2>
      <ProgressBar label="Calories" current={consumed.calories} goal={target.calories} />
      <ProgressBar label="Protein" current={consumed.protein} goal={target.protein} unit="g" />
      <ProgressBar label="Fat" current={consumed.fat} goal={target.fat} unit="g" />
      <ProgressBar label="Carbs" current={consumed.carbs} goal={target.carbs} unit="g" />
    </div>
  );
}
