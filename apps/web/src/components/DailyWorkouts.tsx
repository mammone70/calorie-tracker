import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExercisePicker } from './ExercisePicker';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import {
  BODY_PARTS,
  DEFAULT_WEIGHT_UNIT,
  formatExercisePrescriptionSummary,
  workoutEntryLabel,
  type BodyPart,
  type EffectiveWorkouts,
  type EffectiveWorkoutExercise,
  type Exercise,
  type WeightUnit,
  type WorkoutSetLog,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DailyWorkoutsProps = {
  date: string;
};

function prescriptionKindPlaceholder(
  ex: Pick<EffectiveWorkoutExercise, 'prescriptionKind' | 'prescriptionValue'>,
  weightUnit: WeightUnit,
): string {
  if (ex.prescriptionKind === 'load_increase' && ex.prescriptionValue != null) {
    return `+${ex.prescriptionValue}`;
  }
  return weightUnit;
}

export function DailyWorkouts({ date }: DailyWorkoutsProps) {
  const { user } = useAuth();
  const weightUnit = user?.weightUnit ?? DEFAULT_WEIGHT_UNIT;
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<
    Record<string, { reps: string; weight: string }>
  >({});
  const [addSessionId, setAddSessionId] = useState<string | null>(null);
  const [addEntryKind, setAddEntryKind] = useState<'exercise' | 'bodyPart'>('exercise');
  const [newExerciseId, setNewExerciseId] = useState('');
  const [newBodyPart, setNewBodyPart] = useState<BodyPart | ''>('');
  const [error, setError] = useState('');

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.getExercises() as Promise<Exercise[]>,
  });

  const workoutsQuery = useQuery({
    queryKey: ['workouts-effective', date],
    queryFn: async () => {
      await api.materializeWorkouts(date);
      return api.getEffectiveWorkouts(date) as Promise<EffectiveWorkouts>;
    },
  });

  const exerciseMap = useMemo(
    () => new Map((exercisesQuery.data ?? []).map((ex) => [ex.id, ex.name])),
    [exercisesQuery.data],
  );

  const sessions = workoutsQuery.data?.sessions ?? [];

  useEffect(() => {
    const next: Record<string, { reps: string; weight: string }> = {};
    for (const session of sessions) {
      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          next[set.id] = {
            reps: String(set.actualReps ?? set.targetRepsMax ?? set.targetRepsMin ?? ''),
            weight:
              set.actualWeight != null
                ? String(set.actualWeight)
                : set.targetWeight != null
                  ? String(set.targetWeight)
                  : '',
          };
        }
      }
    }
    setDrafts(next);
  }, [workoutsQuery.dataUpdatedAt]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workouts-effective', date] });
  };

  const ensureOverride = async () => {
    await api.materializeWorkouts(date);
  };

  const confirmSet = async (set: WorkoutSetLog) => {
    const draft = drafts[set.id];
    setError('');
    try {
      await ensureOverride();
      await api.confirmWorkoutSet(set.id, {
        actualReps: draft?.reps ? Number(draft.reps) : undefined,
        actualWeight: draft?.weight === '' || draft?.weight == null ? null : Number(draft.weight),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm set');
    }
  };

  const unconfirmSet = async (id: string) => {
    await api.unconfirmWorkoutSet(id);
    await refresh();
  };

  const removeSet = async (id: string) => {
    await ensureOverride();
    await api.deleteWorkoutSet(id);
    await refresh();
  };

  const addSet = async (dayExerciseId: string) => {
    await ensureOverride();
    await api.addWorkoutSet(dayExerciseId, {});
    await refresh();
  };

  const removeExercise = async (id: string) => {
    await ensureOverride();
    await api.deleteDayWorkoutExercise(id);
    await refresh();
  };

  const addExercise = async (session: {
    id: string;
    name: string;
    sourceTemplateId?: string | null;
  }) => {
    if (addEntryKind === 'exercise' && !newExerciseId) return;
    if (addEntryKind === 'bodyPart' && !newBodyPart) return;
    setError('');
    try {
      const effective = (await api.materializeWorkouts(date)) as EffectiveWorkouts;
      const daySession =
        effective.sessions.find(
          (s) =>
            s.id === session.id ||
            (session.sourceTemplateId && s.sourceTemplateId === session.sourceTemplateId) ||
            s.name === session.name,
        ) ?? effective.sessions[0];
      if (!daySession) throw new Error('No workout session for this day');
      await api.addDayWorkoutExercise(daySession.id, {
        exerciseId: addEntryKind === 'exercise' ? newExerciseId : null,
        bodyPart: addEntryKind === 'bodyPart' ? (newBodyPart as BodyPart) : null,
        targetSets: 3,
        repsMin: 8,
        repsMax: 12,
        sortIndex: 99,
      });
      setNewExerciseId('');
      setNewBodyPart('');
      setAddSessionId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise');
    }
  };

  if (workoutsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading workouts…</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No workouts scheduled for this day. Add templates under Lift.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sessions.map((session) => (
        <Card key={session.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.exercises.map((ex) => {
              const open = expanded[ex.id] ?? false;
              const name = workoutEntryLabel(ex, exerciseMap);
              const confirmed = ex.sets.filter((s) => s.status === 'confirmed').length;
              const summary = formatExercisePrescriptionSummary({
                targetSets: ex.targetSets,
                repsMin: ex.repsMin,
                repsMax: ex.repsMax,
                targetWeight: ex.targetWeight,
                prescriptionKind: ex.prescriptionKind,
                prescriptionValue: ex.prescriptionValue,
                weightUnit,
              });
              return (
                <div key={ex.id} className="rounded-md border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    onClick={() => setExpanded((prev) => ({ ...prev, [ex.id]: !open }))}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{name}</span>{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        {confirmed}/{ex.sets.length || ex.targetSets || 0} sets
                      </span>
                      {summary ? (
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {summary}
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown
                      className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
                    />
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border px-3 py-2">
                      {ex.sets.map((set, index) => {
                        const draft = drafts[set.id] ?? { reps: '', weight: '' };
                        const weightPlaceholder =
                          set.targetWeight != null
                            ? String(set.targetWeight)
                            : prescriptionKindPlaceholder(ex, weightUnit);
                        return (
                          <div
                            key={set.id}
                            className={cn(
                              'grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                              index % 2 === 0 ? 'bg-background' : 'bg-accent',
                            )}
                          >
                            <span className="w-8 text-muted-foreground">#{index + 1}</span>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={draft.reps}
                              disabled={set.status === 'confirmed'}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [set.id]: { ...draft, reps: e.target.value },
                                }))
                              }
                              className={cn(inputFieldClass, 'h-8')}
                              aria-label="Reps"
                              placeholder={`${set.targetRepsMin}${set.targetRepsMax !== set.targetRepsMin ? `–${set.targetRepsMax}` : ''}`}
                            />
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={draft.weight}
                              disabled={set.status === 'confirmed'}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [set.id]: { ...draft, weight: e.target.value },
                                }))
                              }
                              className={cn(inputFieldClass, 'h-8')}
                              aria-label="Weight"
                              placeholder={weightPlaceholder || weightUnit}
                            />
                            <div className="flex gap-1">
                              {set.status === 'confirmed' ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  onClick={() => void unconfirmSet(set.id)}
                                  aria-label="Unconfirm set"
                                >
                                  <Check className="size-4 text-primary" />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  onClick={() => void confirmSet(set)}
                                  aria-label="Confirm set"
                                >
                                  <Check className="size-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => void removeSet(set.id)}
                                aria-label="Remove set"
                              >
                                <Minus className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => void addSet(ex.id)}
                        >
                          <Plus className="size-4" />
                          Add set
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void removeExercise(ex.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {addSessionId === session.id ? (
              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={addEntryKind === 'exercise' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setAddEntryKind('exercise')}
                  >
                    Exercise
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={addEntryKind === 'bodyPart' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setAddEntryKind('bodyPart')}
                  >
                    Body part
                  </Button>
                </div>
                {addEntryKind === 'exercise' ? (
                  <ExercisePicker
                    exercises={exercisesQuery.data ?? []}
                    value={newExerciseId}
                    onChange={setNewExerciseId}
                  />
                ) : (
                  <Select
                    value={newBodyPart || undefined}
                    onValueChange={(value) => setNewBodyPart(value as BodyPart)}
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
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="sm"
                    disabled={
                      addEntryKind === 'exercise' ? !newExerciseId : !newBodyPart
                    }
                    onClick={() => void addExercise(session)}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setAddSessionId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAddSessionId(session.id)}
              >
                + Add exercise
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
