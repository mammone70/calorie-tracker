import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExercisePicker } from '../components/ExercisePicker';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/client';
import { WEEKDAYS } from '@calorie-tracker/shared';
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

export function WorkoutsPage({
  forUserId,
  backTo = '/exercises',
  title = 'Workout templates',
}: WorkoutsPageProps) {
  const queryClient = useQueryClient();
  const opts = forUserOpts(forUserId);
  const [name, setName] = useState('');
  const [scheduleKind, setScheduleKind] = useState<'weekday' | 'interval'>('weekday');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [intervalDays, setIntervalDays] = useState(3);
  const [anchorDate, setAnchorDate] = useState(todayDateString());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState('');
  const [targetSets, setTargetSets] = useState(3);
  const [repsMin, setRepsMin] = useState(8);
  const [repsMax, setRepsMax] = useState(12);
  const [targetWeight, setTargetWeight] = useState('');
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
  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises],
  );

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
      setSelectedTemplateId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteWorkoutTemplate(id, opts);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
  };

  const addExercise = async () => {
    if (!selectedTemplateId || !exerciseId) return;
    setError('');
    try {
      await api.addWorkoutTemplateExercise(
        selectedTemplateId,
        {
          exerciseId,
          targetSets,
          repsMin,
          repsMax,
          targetWeight: targetWeight === '' ? null : Number(targetWeight),
          sortIndex: (templateExercisesQuery.data ?? []).length,
        },
        opts,
      );
      setExerciseId('');
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
            <CardTitle>New template</CardTitle>
            <CardDescription>Weekday or every N days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Template name (e.g. Push)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputFieldClass)}
            />
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
                Interval
              </Button>
            </div>
            {scheduleKind === 'weekday' ? (
              <select
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
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className={cn(inputFieldClass)}
                  aria-label="Interval days"
                />
                <Input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className={cn(inputFieldClass)}
                  aria-label="Anchor date"
                />
              </div>
            )}
            <Button className="w-full" disabled={!name.trim()} onClick={() => void createTemplate()}>
              Create template
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
                onClick={() => setSelectedTemplateId(template.id)}
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

        {selectedTemplateId && (
          <Card>
            <CardHeader>
              <CardTitle>Exercises</CardTitle>
              <CardDescription>Sets × rep range (and optional target weight)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ExercisePicker
                exercises={exercises}
                value={exerciseId}
                onChange={setExerciseId}
              />
              <div className="grid grid-cols-4 gap-2">
                <Input
                  type="number"
                  min={1}
                  value={targetSets}
                  onChange={(e) => setTargetSets(Number(e.target.value))}
                  className={cn(inputFieldClass)}
                  aria-label="Sets"
                  placeholder="Sets"
                />
                <Input
                  type="number"
                  min={0}
                  value={repsMin}
                  onChange={(e) => setRepsMin(Number(e.target.value))}
                  className={cn(inputFieldClass)}
                  aria-label="Reps min"
                  placeholder="Min"
                />
                <Input
                  type="number"
                  min={0}
                  value={repsMax}
                  onChange={(e) => setRepsMax(Number(e.target.value))}
                  className={cn(inputFieldClass)}
                  aria-label="Reps max"
                  placeholder="Max"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className={cn(inputFieldClass)}
                  aria-label="Weight"
                  placeholder="kg"
                />
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
                        {row.targetSets} × {row.repsMin}
                        {row.repsMax !== row.repsMin ? `–${row.repsMax}` : ''}
                        {row.targetWeight != null ? ` @ ${row.targetWeight}` : ''}
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
