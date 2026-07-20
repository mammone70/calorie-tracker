import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '../components/PageHeader';
import { WorkoutEntryDialog, type WorkoutEntryFormValues } from '../components/WorkoutEntryDialog';
import { WorkoutProgramBoard } from '../components/WorkoutProgramBoard';
import { useAuth } from '../contexts/AuthContext';
import { useMinWidth } from '../hooks/useMinWidth';
import { api } from '../lib/client';
import {
  DEFAULT_WEIGHT_UNIT,
  WEEKDAYS,
  formatExercisePrescriptionSummary,
  workoutEntryLabel,
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

export function WorkoutsPage({
  forUserId,
  backTo = '/exercises',
  title = 'Workout templates',
}: WorkoutsPageProps) {
  const { user } = useAuth();
  const weightUnit = user?.weightUnit ?? DEFAULT_WEIGHT_UNIT;
  // Spreadsheet needs horizontal room; don't rely only on Tailwind `md` (can miss
  // some desktop / maximized windows depending on zoom and chrome).
  const showProgramBoard = useMinWidth(700);
  const queryClient = useQueryClient();
  const opts = forUserOpts(forUserId);
  const [name, setName] = useState('');
  const [scheduleKind, setScheduleKind] = useState<'weekday' | 'interval'>('weekday');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [intervalDays, setIntervalDays] = useState(3);
  const [anchorDate, setAnchorDate] = useState(todayDateString());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [entryDialog, setEntryDialog] = useState<
    | { mode: 'add' }
    | { mode: 'edit'; entry: WorkoutTemplateExercise }
    | null
  >(null);
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
  const templateExercises = templateExercisesQuery.data ?? [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex.name])),
    [exercises],
  );

  const invalidateTemplateExercises = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['workout-template-exercises', selectedTemplateId, forUserId],
    });
    await queryClient.invalidateQueries({ queryKey: ['workout-board', forUserId] });
  };

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === id);
    setEditName(template?.name ?? '');
    setError('');
  };

  const closeEditor = () => {
    setSelectedTemplateId(null);
    setEditName('');
    setEntryDialog(null);
  };

  const renameTemplate = async () => {
    if (!selectedTemplateId || !editName.trim()) return;
    setError('');
    try {
      await api.updateWorkoutTemplate(selectedTemplateId, { name: editName.trim() }, opts);
      await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
      await queryClient.invalidateQueries({ queryKey: ['workout-board', forUserId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename workout');
    }
  };

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
      await queryClient.invalidateQueries({ queryKey: ['workout-board', forUserId] });
      setEditName(created.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteWorkoutTemplate(id, opts);
    if (selectedTemplateId === id) closeEditor();
    await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
    await queryClient.invalidateQueries({ queryKey: ['workout-board', forUserId] });
  };

  const saveMobileEntry = async (values: WorkoutEntryFormValues) => {
    if (!selectedTemplateId || !entryDialog) return;
    const payload = {
      exerciseId: values.exerciseId,
      bodyPart: values.bodyPart,
      weekIndex: values.weekIndex,
      targetSets: values.targetSets,
      repsMin: values.repsMin,
      repsMax: values.repsMax,
      targetWeight: values.targetWeight,
      prescriptionKind: values.prescriptionKind,
      prescriptionValue: values.prescriptionValue,
    };
    if (entryDialog.mode === 'add') {
      await api.addWorkoutTemplateExercise(
        selectedTemplateId,
        { ...payload, sortIndex: templateExercises.length },
        opts,
      );
    } else {
      await api.updateWorkoutTemplateExercise(entryDialog.entry.id, payload, opts);
    }
    await invalidateTemplateExercises();
  };

  const removeExercise = async (id: string) => {
    setError('');
    try {
      await api.deleteWorkoutTemplateExercise(id, opts);
      await invalidateTemplateExercises();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove row');
    }
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
      <div
        className={cn(
          'mx-auto w-full min-w-0 space-y-4 px-4 pb-8 pt-4',
          showProgramBoard ? 'max-w-[1400px]' : 'max-w-lg',
        )}
      >
        {!forUserId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-bold">{title}</h1>
            <Button variant="outline" asChild>
              <Link to="/exercises">Exercise library</Link>
            </Button>
          </div>
        )}

        {showProgramBoard ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Program board</CardTitle>
              <CardDescription>
                Plan the block like a spreadsheet — days across, weeks down. Each cell can be an
                exercise or a body part.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkoutProgramBoard forUserId={forUserId} exercises={exercises} />
            </CardContent>
          </Card>
        ) : (
        <div className="space-y-4">
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

          {error && !selectedTemplate && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <ul className="space-y-2">
            {templates.map((template) => (
              <li key={template.id}>
                <Card
                  className="cursor-pointer transition-colors active:bg-muted/40"
                  onClick={() => selectTemplate(template.id)}
                >
                  <CardHeader className="pb-2">
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

          <Dialog
            open={!!selectedTemplate}
            onOpenChange={(open) => {
              if (!open) closeEditor();
            }}
          >
            <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
              <DialogHeader className="border-b border-border px-4 py-4 pr-12">
                <DialogTitle>Edit workout</DialogTitle>
                <DialogDescription>
                  {selectedTemplate ? scheduleLabel(selectedTemplate) : null}
                </DialogDescription>
              </DialogHeader>

              {selectedTemplate && (
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {error && <p className="text-sm text-destructive">{error}</p>}

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

                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Exercises</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setEntryDialog({ mode: 'add' })}
                      >
                        Add
                      </Button>
                    </div>

                    {templateExercises.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No exercises yet. Tap Add to include an exercise or body part.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {templateExercises.map((row) => {
                          const summary = formatExercisePrescriptionSummary({
                            ...row,
                            weightUnit,
                          });
                          return (
                            <li
                              key={row.id}
                              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => setEntryDialog({ mode: 'edit', entry: row })}
                              >
                                <p className="font-medium">
                                  {workoutEntryLabel(row, exerciseMap)}
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    W{row.weekIndex ?? 1}
                                    {row.bodyPart ? ' · body part' : ''}
                                  </span>
                                </p>
                                {summary ? (
                                  <p className="text-xs text-muted-foreground">{summary}</p>
                                ) : null}
                              </button>
                              <Button
                                variant="link"
                                className="h-auto shrink-0 p-0 text-destructive"
                                onClick={() => void removeExercise(row.id)}
                              >
                                Remove
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <WorkoutEntryDialog
            open={entryDialog != null}
            onOpenChange={(open) => {
              if (!open) setEntryDialog(null);
            }}
            mode={entryDialog?.mode === 'edit' ? 'edit' : 'add'}
            exercises={exercises}
            weightUnit={weightUnit}
            initial={entryDialog?.mode === 'edit' ? entryDialog.entry : null}
            showWeekIndex
            onSubmit={saveMobileEntry}
          />
        </div>
        )}
      </div>
    </div>
  );
}
