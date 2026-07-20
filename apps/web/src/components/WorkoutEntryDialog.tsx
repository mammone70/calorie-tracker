import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExercisePicker } from './ExercisePicker';
import {
  BODY_PARTS,
  DEFAULT_WEIGHT_UNIT,
  type BodyPart,
  type Exercise,
  type PrescriptionKind,
  type WeightUnit,
  type WorkoutTemplateExercise,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';

const PRESCRIPTION_OPTIONS: { value: PrescriptionKind; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'rpe', label: 'RPE' },
  { value: 'rir', label: 'RIR' },
  { value: 'load_increase', label: 'Increase vs last' },
];

export type WorkoutEntryFormValues = {
  entryKind: 'exercise' | 'bodyPart';
  exerciseId: string | null;
  bodyPart: BodyPart | null;
  weekIndex: number;
  targetSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  targetWeight: number | null;
  prescriptionKind: PrescriptionKind;
  prescriptionValue: number | null;
};

type WorkoutEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  exercises: Exercise[];
  weightUnit?: WeightUnit;
  initial?: WorkoutTemplateExercise | null;
  defaultWeekIndex?: number;
  showWeekIndex?: boolean;
  weekLabel?: string;
  dayLabel?: string;
  onSubmit: (values: WorkoutEntryFormValues) => Promise<void>;
};

function emptyForm(defaultWeekIndex = 1): {
  entryKind: 'exercise' | 'bodyPart';
  exerciseId: string;
  bodyPart: BodyPart | '';
  weekIndex: string;
  targetSets: string;
  repsMin: string;
  repsMax: string;
  targetWeight: string;
  prescriptionKind: PrescriptionKind;
  prescriptionValue: string;
} {
  return {
    entryKind: 'exercise',
    exerciseId: '',
    bodyPart: '',
    weekIndex: String(defaultWeekIndex),
    targetSets: '',
    repsMin: '',
    repsMax: '',
    targetWeight: '',
    prescriptionKind: 'none',
    prescriptionValue: '',
  };
}

function formFromEntry(entry: WorkoutTemplateExercise): ReturnType<typeof emptyForm> {
  return {
    entryKind: entry.bodyPart ? 'bodyPart' : 'exercise',
    exerciseId: entry.exerciseId ?? '',
    bodyPart: (entry.bodyPart as BodyPart | '') || '',
    weekIndex: String(entry.weekIndex ?? 1),
    targetSets: entry.targetSets != null ? String(entry.targetSets) : '',
    repsMin: entry.repsMin != null ? String(entry.repsMin) : '',
    repsMax: entry.repsMax != null ? String(entry.repsMax) : '',
    targetWeight: entry.targetWeight != null ? String(entry.targetWeight) : '',
    prescriptionKind: entry.prescriptionKind,
    prescriptionValue: entry.prescriptionValue != null ? String(entry.prescriptionValue) : '',
  };
}

function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function WorkoutEntryDialog({
  open,
  onOpenChange,
  mode,
  exercises,
  weightUnit = DEFAULT_WEIGHT_UNIT,
  initial,
  defaultWeekIndex = 1,
  showWeekIndex = false,
  weekLabel,
  dayLabel,
  onSubmit,
}: WorkoutEntryDialogProps) {
  const [form, setForm] = useState(() => emptyForm(defaultWeekIndex));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(initial ? formFromEntry(initial) : emptyForm(defaultWeekIndex));
  }, [open, initial, defaultWeekIndex]);

  const canSave =
    form.entryKind === 'exercise' ? !!form.exerciseId : !!form.bodyPart;

  const handleSubmit = async () => {
    if (!canSave) return;
    setError('');
    setSaving(true);
    try {
      const targetSets = parseOptionalInt(form.targetSets);
      let repsMin = parseOptionalInt(form.repsMin);
      let repsMax = parseOptionalInt(form.repsMax);
      if (repsMin != null && repsMax == null) repsMax = repsMin;
      if (repsMax != null && repsMin == null) repsMin = repsMax;

      const prescriptionKind = form.prescriptionKind;
      const prescriptionValue =
        prescriptionKind === 'none' || form.prescriptionValue.trim() === ''
          ? null
          : Number(form.prescriptionValue);

      await onSubmit({
        entryKind: form.entryKind,
        exerciseId: form.entryKind === 'exercise' ? form.exerciseId : null,
        bodyPart: form.entryKind === 'bodyPart' ? (form.bodyPart as BodyPart) : null,
        weekIndex: Math.max(1, parseOptionalInt(form.weekIndex) ?? defaultWeekIndex),
        targetSets,
        repsMin,
        repsMax,
        targetWeight:
          form.targetWeight.trim() === '' ? null : Number(form.targetWeight),
        prescriptionKind,
        prescriptionValue,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const context =
    weekLabel || dayLabel
      ? [weekLabel, dayLabel].filter(Boolean).join(' · ')
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add entry' : 'Edit entry'}</DialogTitle>
          <DialogDescription>
            {context
              ? `${context}. Sets, reps, and intensity are optional.`
              : 'Sets, reps, and intensity are optional.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={form.entryKind === 'exercise' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setForm((f) => ({ ...f, entryKind: 'exercise', bodyPart: '' }))}
            >
              Exercise
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.entryKind === 'bodyPart' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setForm((f) => ({ ...f, entryKind: 'bodyPart', exerciseId: '' }))}
            >
              Body part
            </Button>
          </div>

          {form.entryKind === 'exercise' ? (
            <div className="space-y-1">
              <Label>Exercise</Label>
              <ExercisePicker
                exercises={exercises}
                value={form.exerciseId}
                onChange={(exerciseId) => setForm((f) => ({ ...f, exerciseId }))}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Body part</Label>
              <Select
                value={form.bodyPart || undefined}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, bodyPart: value as BodyPart }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose body part…" />
                </SelectTrigger>
                <SelectContent>
                  {BODY_PARTS.map((part) => (
                    <SelectItem key={part} value={part}>
                      {part}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showWeekIndex && (
            <div className="space-y-1">
              <Label htmlFor="entry-week">Program week</Label>
              <Input
                id="entry-week"
                type="number"
                min={1}
                max={52}
                className={cn(inputFieldClass)}
                value={form.weekIndex}
                onChange={(e) => setForm((f) => ({ ...f, weekIndex: e.target.value }))}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="entry-sets">Sets</Label>
              <Input
                id="entry-sets"
                type="number"
                min={1}
                className={cn(inputFieldClass)}
                placeholder="—"
                value={form.targetSets}
                onChange={(e) => setForm((f) => ({ ...f, targetSets: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entry-reps-min">Reps</Label>
              <Input
                id="entry-reps-min"
                type="number"
                min={0}
                className={cn(inputFieldClass)}
                placeholder="—"
                value={form.repsMin}
                onChange={(e) => {
                  const repsMin = e.target.value;
                  setForm((f) => ({
                    ...f,
                    repsMin,
                    repsMax: f.repsMax === '' || f.repsMax === f.repsMin ? repsMin : f.repsMax,
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entry-reps-max">Reps max</Label>
              <Input
                id="entry-reps-max"
                type="number"
                min={0}
                className={cn(inputFieldClass)}
                placeholder="—"
                value={form.repsMax}
                onChange={(e) => setForm((f) => ({ ...f, repsMax: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="entry-weight">Weight ({weightUnit})</Label>
              <Input
                id="entry-weight"
                type="number"
                min={0}
                step="0.5"
                className={cn(inputFieldClass)}
                placeholder="—"
                value={form.targetWeight}
                onChange={(e) => setForm((f) => ({ ...f, targetWeight: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Intensity</Label>
              <Select
                value={form.prescriptionKind}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    prescriptionKind: value as PrescriptionKind,
                    prescriptionValue: value === 'none' ? '' : f.prescriptionValue,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESCRIPTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.prescriptionKind !== 'none' && (
            <div className="space-y-1">
              <Label htmlFor="entry-intensity-value">
                {form.prescriptionKind === 'rpe'
                  ? 'RPE'
                  : form.prescriptionKind === 'rir'
                    ? 'RIR'
                    : `Increase (${weightUnit})`}
              </Label>
              <Input
                id="entry-intensity-value"
                type="number"
                min={0}
                step="0.5"
                className={cn(inputFieldClass)}
                value={form.prescriptionValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prescriptionValue: e.target.value }))
                }
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave || saving} onClick={() => void handleSubmit()}>
            {saving ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
