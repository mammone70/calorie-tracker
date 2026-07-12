import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExercisePicker } from '../components/ExercisePicker';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import {
  DEFAULT_WEIGHT_UNIT,
  WEEKDAYS,
  formatExercisePrescriptionSummary,
  type PrescriptionKind,
} from '@calorie-tracker/shared';
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';
import { todayDateString } from '@calorie-tracker/client';

const forUserOpts = (forUserId?: string) => (forUserId ? { forUserId } : {});

type WorkoutsPageProps = {
  forUserId?: string;
  backTo?: string;
  title?: string;
};

const PRESCRIPTION_OPTIONS: { value: PrescriptionKind; label: string }[] = [
  { value: 'none', label: 'No intensity cue' },
  { value: 'rpe', label: 'RPE' },
  { value: 'rir', label: 'RIR' },
  { value: 'load_increase', label: 'Increase vs last' },
];

export function WorkoutsPage({
  forUserId,
  backTo = '/exercises',
  title = 'Workout templates',
}: WorkoutsPageProps) {
  const { user } = useAuth();
  const weightUnit = user?.weightUnit ?? DEFAULT_WEIGHT_UNIT;
  const queryClient = useQueryClient();
  const opts = forUserOpts(forUserId);
  const [name, setName] = useState('');
  const [scheduleKind, setScheduleKind] = useState<'weekday' | 'interval'>('weekday');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [intervalDays, setIntervalDays] = useState(3);
  const [anchorDate, setAnchorDate] = useState(todayDateString());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [targetSets, setTargetSets] = useState(3);
  const [repsMode, setRepsMode] = useState<'exact' | 'range'>('exact');
  const [repsMin, setRepsMin] = useState(8);
  const [repsMax, setRepsMax] = useState(8);
  const [targetWeight, setTargetWeight] = useState('');
  const [prescriptionKind, setPrescriptionKind] = useState<PrescriptionKind>('none');
  const [prescriptionValue, setPrescriptionValue] = useState('');
  const [error, setError] = useState('');

  const templatesQuery = useQuery({
    queryKey: ['workout-templates', forUserId],
    queryFn: () => api.getWorkoutTemplates(opts) as Promise<WorkoutTemplate[]>,
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises', forUserId],
    queryFn: () => api.getExercises(opts) as Promise<Exercise[]>,
  });

  const templateExercisesQuery = useQuery({
    queryKey: ['workout-template-exercises', selectedTemplateId, forUserId],
    enabled: !!selectedTemplateId,
    queryFn: () =>
      api.getWorkoutTemplateExercises(selectedTemplateId!, opts) as Promise<
        WorkoutTemplateExercise[]
      >,
  });

  const templates = templatesQuery.data ?? [];
  const exercises = exercisesQuery.data ?? [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises],
  );

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === id);
    setEditName(template?.name ?? '');
  };

  const renameTemplate = async () => {
    if (!selectedTemplateId || !editName.trim()) return;
    setError('');
    try {
      await api.updateWorkoutTemplate(selectedTemplateId, { name: editName.trim() }, opts);
      await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename workout');
    }
  };

  const prescriptionPlaceholder =
    prescriptionKind === 'rpe'
      ? 'RPE 1–10'
      : prescriptionKind === 'rir'
        ? 'RIR 0–10'
        : prescriptionKind === 'load_increase'
          ? `+${weightUnit}`
          : '';

  const createTemplate = async () => {
    setError('');
    try {
      const created = (await api.createWorkoutTemplate(
        {
          name: name.trim(),
          scheduleKind,
          dayOfWeek: scheduleKind === 'weekday' ? dayOfWeek : null,
          intervalDays: scheduleKind === 'interval' ? intervalDays : null,
          anchorDate: scheduleKind === 'interval' ? anchorDate : null,
          isActive: true,
        },
        opts,
      )) as WorkoutTemplate;
      setName('');
      selectTemplate(created.id);
      await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
      setEditName(created.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteWorkoutTemplate(id, opts);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null);
      setEditName('');
    }
    await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
  };

  const addExercise = async () => {
    if (!selectedTemplateId || !exerciseId) return;
    setError('');
    const resolvedRepsMin = repsMin;
    const resolvedRepsMax = repsMode === 'exact' ? repsMin : repsMax;
    try {
      await api.addWorkoutTemplateExercise(
        selectedTemplateId,
        {
          exerciseId,
          targetSets,
          repsMin: resolvedRepsMin,
          repsMax: resolvedRepsMax,
          targetWeight: targetWeight === '' ? null : Number(targetWeight),
          prescriptionKind,
          prescriptionValue:
            prescriptionKind === 'none' || prescriptionValue === ''
              ? null
              : Number(prescriptionValue),
          sortIndex: (templateExercisesQuery.data ?? []).length,
        },
        opts,
      );
      setExerciseId('');
      setTargetWeight('');
      setPrescriptionKind('none');
      setPrescriptionValue('');
      await queryClient.invalidateQueries({
        queryKey: ['workout-template-exercises', selectedTemplateId, forUserId],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise');
    }
  };

  const removeExercise = async (id: string) => {
    await api.deleteWorkoutTemplateExercise(id, opts);
    await queryClient.invalidateQueries({
      queryKey: ['workout-template-exercises', selectedTemplateId, forUserId],
    });
  };

  const scheduleLabel = (t: WorkoutTemplate) => {
    if (t.scheduleKind === 'weekday') {
      return WEEKDAYS[t.dayOfWeek ?? 0] ?? `Day ${t.dayOfWeek}`;
    }
    return `Every ${t.intervalDays} days from ${t.anchorDate}`;
  };

  return (
    <div>
      {forUserId ? <PageHeader title={title} backTo={backTo} /> : null}
      <div className="mx-auto w-full min-w-0 max-w-lg space-y-4 px-4 pb-8 pt-4">
        {!forUserId && (
          <>
            <h1 className="text-lg font-bold">{title}</h1>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/exercises">Exercise library</Link>
            </Button>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>New workout</CardTitle>
            <CardDescription>
              Give it a title (Heavy Upper, ME DL…), then choose when it runs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="workout-title">Workout title</Label>
              <Input
                id="workout-title"
                placeholder="e.g. Heavy Upper, Light Lower, ME DL"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(inputFieldClass)}
              />
            </div>
            <div className="space-y-1">
              <Label>Schedule</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scheduleKind === 'weekday' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setScheduleKind('weekday')}
                >
                  Weekday
                </Button>
                <Button
                  type="button"
                  variant={scheduleKind === 'interval' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setScheduleKind('interval')}
                >
                  Every N days
                </Button>
              </div>
            </div>
            {scheduleKind === 'weekday' ? (
              <div className="space-y-1">
                <Label htmlFor="workout-weekday">Day of week</Label>
                <select
                  id="workout-weekday"
                  className={cn(inputFieldClass)}
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                >
                  {WEEKDAYS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="workout-interval">Every N days</Label>
                  <Input
                    id="workout-interval"
                    type="number"
                    min={1}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Number(e.target.value))}
                    className={cn(inputFieldClass)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="workout-anchor">Anchor date</Label>
                  <Input
                    id="workout-anchor"
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    className={cn(inputFieldClass)}
                  />
                </div>
              </div>
            )}
            <Button className="w-full" disabled={!name.trim()} onClick={() => void createTemplate()}>
              Create workout
            </Button>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <ul className="space-y-2">
          {templates.map((template) => (
            <li key={template.id}>
              <Card
                className={cn(
                  'cursor-pointer',
                  selectedTemplateId === template.id && 'ring-2 ring-primary',
                )}
                onClick={() => selectTemplate(template.id)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription>{scheduleLabel(template)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteTemplate(template.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        {selectedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>Edit workout</CardTitle>
              <CardDescription>{scheduleLabel(selectedTemplate)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-workout-title">Workout title</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-workout-title"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={cn(inputFieldClass)}
                    placeholder="e.g. Heavy Upper"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!editName.trim() || editName.trim() === selectedTemplate.name}
                    onClick={() => void renameTemplate()}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-sm font-medium">Exercises</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Sets × exact reps or a range, optional weight ({weightUnit}), and intensity cue
                </p>
              <ExercisePicker
                exercises={exercises}
                value={exerciseId}
                onChange={setExerciseId}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={repsMode === 'exact' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setRepsMode('exact');
                    setRepsMax(repsMin);
                  }}
                >
                  Exact reps
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={repsMode === 'range' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setRepsMode('range');
                    if (repsMax <= repsMin) setRepsMax(repsMin + 2);
                  }}
                >
                  Rep range
                </Button>
              </div>
              <div className={cn('grid gap-2', repsMode === 'exact' ? 'grid-cols-3' : 'grid-cols-4')}>
                <div className="space-y-1">
                  <Label htmlFor="template-sets">Sets</Label>
                  <Input
                    id="template-sets"
                    type="number"
                    min={1}
                    value={targetSets}
                    onChange={(e) => setTargetSets(Number(e.target.value))}
                    className={cn(inputFieldClass)}
                  />
                </div>
                {repsMode === 'exact' ? (
                  <div className="space-y-1">
                    <Label htmlFor="template-reps">Reps</Label>
                    <Input
                      id="template-reps"
                      type="number"
                      min={0}
                      value={repsMin}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setRepsMin(value);
                        setRepsMax(value);
                      }}
                      className={cn(inputFieldClass)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="template-reps-min">Reps min</Label>
                      <Input
                        id="template-reps-min"
                        type="number"
                        min={0}
                        value={repsMin}
                        onChange={(e) => setRepsMin(Number(e.target.value))}
                        className={cn(inputFieldClass)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="template-reps-max">Reps max</Label>
                      <Input
                        id="template-reps-max"
                        type="number"
                        min={0}
                        value={repsMax}
                        onChange={(e) => setRepsMax(Number(e.target.value))}
                        className={cn(inputFieldClass)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label htmlFor="template-weight">Weight ({weightUnit})</Label>
                  <Input
                    id="template-weight"
                    type="number"
                    min={0}
                    step="0.5"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    className={cn(inputFieldClass)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="template-intensity">Intensity</Label>
                  <Select
                    value={prescriptionKind}
                    onValueChange={(value) => {
                      const kind = value as PrescriptionKind;
                      setPrescriptionKind(kind);
                      if (kind === 'none') setPrescriptionValue('');
                    }}
                  >
                    <SelectTrigger id="template-intensity" className="w-full">
                      <SelectValue placeholder="Intensity" />
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
                <div className="space-y-1">
                  <Label htmlFor="template-intensity-value">
                    {prescriptionKind === 'rpe'
                      ? 'RPE'
                      : prescriptionKind === 'rir'
                        ? 'RIR'
                        : prescriptionKind === 'load_increase'
                          ? `Increase (${weightUnit})`
                          : 'Value'}
                  </Label>
                  <Input
                    id="template-intensity-value"
                    type="number"
                    min={0}
                    step="0.5"
                    value={prescriptionValue}
                    disabled={prescriptionKind === 'none'}
                    onChange={(e) => setPrescriptionValue(e.target.value)}
                    className={cn(inputFieldClass)}
                    placeholder={prescriptionPlaceholder || '—'}
                  />
                </div>
              </div>
              <Button className="w-full" disabled={!exerciseId} onClick={() => void addExercise()}>
                Add exercise
              </Button>

              <ul className="space-y-2">
                {(templateExercisesQuery.data ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{exerciseMap.get(row.exerciseId)?.name ?? 'Exercise'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatExercisePrescriptionSummary({
                          ...row,
                          weightUnit,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-destructive"
                      onClick={() => void removeExercise(row.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
