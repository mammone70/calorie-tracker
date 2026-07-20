import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkoutEntryDialog, type WorkoutEntryFormValues } from './WorkoutEntryDialog';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/client';
import {
  forgetWorkoutEntryClientId,
  optimisticTemplateExercise,
  patchWorkoutExerciseCaches,
  rememberWorkoutEntryServerId,
  removeWorkoutEntryFromCaches,
  resolveWorkoutEntryServerId,
  restoreWorkoutExerciseCaches,
  setPendingWorkoutCreate,
  snapshotWorkoutExerciseCaches,
  takePendingWorkoutCreate,
  upsertWorkoutEntryInCaches,
  workoutBoardQueryKey,
  type WorkoutBoardData,
} from '../lib/workout-entry-ui';
import {
  DEFAULT_WEIGHT_UNIT,
  WEEKDAYS,
  formatExercisePrescriptionSummary,
  workoutEntryLabel,
  type Exercise,
  type WorkoutTemplate,
  type WorkoutTemplateExercise,
} from '@calorie-tracker/shared';
import { cn, inputFieldClass } from '@/lib/utils';

type WorkoutProgramBoardProps = {
  forUserId?: string;
  exercises: Exercise[];
};

const forUserOpts = (forUserId?: string) => (forUserId ? { forUserId } : {});

type DialogState =
  | { mode: 'add'; weekIndex: number; dayOfWeek: number }
  | { mode: 'edit'; entry: WorkoutTemplateExercise; weekIndex: number; dayOfWeek: number }
  | null;

export function WorkoutProgramBoard({ forUserId, exercises }: WorkoutProgramBoardProps) {
  const { user } = useAuth();
  const weightUnit = user?.weightUnit ?? DEFAULT_WEIGHT_UNIT;
  const opts = forUserOpts(forUserId);
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  /** Fade these out before removing from the query cache (table rows skip AnimatePresence exits). */
  const [fadingOutIds, setFadingOutIds] = useState(() => new Set<string>());
  const fadingOutIdsRef = useRef(fadingOutIds);
  fadingOutIdsRef.current = fadingOutIds;
  const fadeOutTemplateById = useRef(new Map<string, string>());

  const boardQueryKey = workoutBoardQueryKey(forUserId);

  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    staleTime: 15_000,
    queryFn: async (): Promise<WorkoutBoardData> => {
      await api.ensureWorkoutBoard(opts);
      const [templates, entries, block] = await Promise.all([
        api.getWorkoutTemplates(opts) as Promise<WorkoutBoardData['templates']>,
        api.getAllWorkoutTemplateExercises(opts) as Promise<WorkoutTemplateExercise[]>,
        api.getWorkoutBlock(opts) as Promise<WorkoutBoardData['block']>,
      ]);
      return { templates, entries, block };
    },
  });

  const templates = boardQuery.data?.templates ?? [];
  const entries = boardQuery.data?.entries ?? [];
  const block = boardQuery.data?.block;
  const weekCount = block?.weekCount ?? 3;
  const actingUserId = forUserId ?? user?.id ?? '';

  const weekdayTemplates = useMemo(() => {
    const byDay = new Map<number, WorkoutTemplate>();
    for (const template of templates) {
      if (template.scheduleKind !== 'weekday' || template.dayOfWeek == null) continue;
      if (!byDay.has(template.dayOfWeek)) byDay.set(template.dayOfWeek, template);
    }
    return WEEKDAYS.map((_, dayOfWeek) => byDay.get(dayOfWeek) ?? null);
  }, [templates]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex.name])),
    [exercises],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: boardQueryKey });
    await queryClient.invalidateQueries({ queryKey: ['workout-templates', forUserId] });
  };

  const cellEntries = (weekIndex: number, dayOfWeek: number) => {
    const template = weekdayTemplates[dayOfWeek];
    if (!template) return [];
    return entries
      .filter((row) => row.templateId === template.id && (row.weekIndex ?? 1) === weekIndex)
      .sort((a, b) => a.sortIndex - b.sortIndex);
  };

  const renameDayFocus = async (dayOfWeek: number, name: string) => {
    const template = weekdayTemplates[dayOfWeek];
    if (!template || !name.trim() || name.trim() === template.name) return;
    setError('');
    try {
      await api.updateWorkoutTemplate(template.id, { name: name.trim() }, opts);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename day');
    }
  };

  const updateBlock = async (patch: { startDate?: string | null; weekCount?: number }) => {
    setError('');
    try {
      await api.updateWorkoutBlock(patch, opts);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update block');
    }
  };

  const commitRemoveEntry = async (id: string, templateId: string) => {
    setError('');
    const snapshot = snapshotWorkoutExerciseCaches(queryClient, forUserId, templateId);
    removeWorkoutEntryFromCaches(queryClient, forUserId, templateId, id);

    if (dialog?.mode === 'edit' && dialog.entry.id === id) {
      setDialog(null);
    }

    const pending = takePendingWorkoutCreate(id);
    if (pending) {
      try {
        const serverId = await pending;
        forgetWorkoutEntryClientId(id);
        await api.deleteWorkoutTemplateExercise(serverId, opts);
      } catch (err) {
        restoreWorkoutExerciseCaches(queryClient, forUserId, templateId, snapshot);
        setError(err instanceof Error ? err.message : 'Failed to remove entry');
      }
      return;
    }

    try {
      await api.deleteWorkoutTemplateExercise(resolveWorkoutEntryServerId(id), opts);
      forgetWorkoutEntryClientId(id);
    } catch (err) {
      restoreWorkoutExerciseCaches(queryClient, forUserId, templateId, snapshot);
      setError(err instanceof Error ? err.message : 'Failed to remove entry');
    }
  };

  const beginRemoveEntry = (id: string, templateId: string) => {
    if (fadingOutIdsRef.current.has(id)) return;
    fadeOutTemplateById.current.set(id, templateId);
    setFadingOutIds((prev) => new Set(prev).add(id));
  };

  const onRowFadeComplete = (id: string) => {
    if (!fadingOutIdsRef.current.has(id)) return;
    const templateId = fadeOutTemplateById.current.get(id);
    fadeOutTemplateById.current.delete(id);
    const next = new Set(fadingOutIdsRef.current);
    next.delete(id);
    fadingOutIdsRef.current = next;
    setFadingOutIds(next);
    if (!templateId) return;
    void commitRemoveEntry(id, templateId);
  };

  const saveEntry = async (values: WorkoutEntryFormValues) => {
    if (!dialog) return;
    const template = weekdayTemplates[dialog.dayOfWeek];
    if (!template) throw new Error('Day template missing');

    const payload = {
      exerciseId: values.exerciseId,
      bodyPart: values.bodyPart,
      weekIndex: dialog.mode === 'add' ? dialog.weekIndex : values.weekIndex,
      targetSets: values.targetSets,
      repsMin: values.repsMin,
      repsMax: values.repsMax,
      targetWeight: values.targetWeight,
      prescriptionKind: values.prescriptionKind,
      prescriptionValue: values.prescriptionValue,
    };

    if (dialog.mode === 'add') {
      const existing = cellEntries(dialog.weekIndex, dialog.dayOfWeek);
      const tempId = crypto.randomUUID();
      const snapshot = snapshotWorkoutExerciseCaches(queryClient, forUserId, template.id);
      const optimistic = optimisticTemplateExercise({
        id: tempId,
        userId: actingUserId,
        templateId: template.id,
        ...payload,
        sortIndex: existing.length,
      });

      upsertWorkoutEntryInCaches(queryClient, forUserId, template.id, optimistic);

      const createPromise = (async () => {
        const created = (await api.addWorkoutTemplateExercise(
          template.id,
          { ...payload, sortIndex: existing.length },
          opts,
        )) as WorkoutTemplateExercise;
        rememberWorkoutEntryServerId(tempId, created.id);
        patchWorkoutExerciseCaches(queryClient, forUserId, template.id, (rows) =>
          rows.map((entry) => (entry.id === tempId ? created : entry)),
        );
        forgetWorkoutEntryClientId(tempId);
        return created.id;
      })();

      setPendingWorkoutCreate(tempId, createPromise);
      void createPromise.catch((err: unknown) => {
        forgetWorkoutEntryClientId(tempId);
        restoreWorkoutExerciseCaches(queryClient, forUserId, template.id, snapshot);
        setError(err instanceof Error ? err.message : 'Failed to add entry');
      });
      return;
    }

    const entryId = dialog.entry.id;
    const snapshot = snapshotWorkoutExerciseCaches(queryClient, forUserId, template.id);
    const optimisticPatch: WorkoutTemplateExercise = {
      ...dialog.entry,
      ...payload,
      exerciseId: payload.exerciseId,
      bodyPart: payload.bodyPart,
      updatedAt: new Date().toISOString(),
    };

    upsertWorkoutEntryInCaches(queryClient, forUserId, template.id, optimisticPatch, entryId);

    try {
      const updated = (await api.updateWorkoutTemplateExercise(
        resolveWorkoutEntryServerId(entryId),
        payload,
        opts,
      )) as WorkoutTemplateExercise;
      upsertWorkoutEntryInCaches(queryClient, forUserId, template.id, updated, entryId);
      if (entryId !== updated.id) {
        patchWorkoutExerciseCaches(queryClient, forUserId, template.id, (rows) =>
          rows.map((entry) => (entry.id === entryId ? updated : entry)),
        );
      }
    } catch (err) {
      restoreWorkoutExerciseCaches(queryClient, forUserId, template.id, snapshot);
      throw err;
    }
  };

  if (boardQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading program board…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="block-start">Block starts</Label>
          <Input
            id="block-start"
            type="date"
            className={cn(inputFieldClass, 'w-auto')}
            value={block?.startDate ?? ''}
            onChange={(e) =>
              void updateBlock({ startDate: e.target.value === '' ? null : e.target.value })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="block-weeks">Weeks</Label>
          <Input
            id="block-weeks"
            type="number"
            min={1}
            max={16}
            className={cn(inputFieldClass, 'w-20')}
            value={weekCount}
            onChange={(e) => void updateBlock({ weekCount: Number(e.target.value) || 1 })}
          />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          Click an entry to edit sets/reps. Leave targets blank for open slots.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 border-b border-r border-border bg-muted/50 px-2 py-2" />
              {WEEKDAYS.map((day) => (
                <th
                  key={day}
                  className="border-b border-r border-border bg-primary px-2 py-2 text-center text-xs font-semibold text-primary-foreground last:border-r-0"
                >
                  {day}
                </th>
              ))}
            </tr>
            <tr>
              <th className="border-b border-r border-border bg-muted px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                Focus
              </th>
              {WEEKDAYS.map((_, dayOfWeek) => {
                const template = weekdayTemplates[dayOfWeek];
                return (
                  <th
                    key={dayOfWeek}
                    className="border-b border-r border-border bg-muted p-1 last:border-r-0"
                  >
                    <Input
                      className="h-8 border-0 bg-transparent px-1 text-center text-xs font-semibold text-foreground shadow-none focus-visible:ring-1"
                      defaultValue={template?.name ?? ''}
                      key={`${template?.id}-${template?.name}`}
                      onBlur={(e) => void renameDayFocus(dayOfWeek, e.target.value)}
                      placeholder="Day focus"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, i) => i + 1).map((weekIndex) => (
              <tr key={weekIndex} className="align-top">
                <th className="border-b border-r border-border bg-muted px-2 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Week {weekIndex}
                </th>
                {WEEKDAYS.map((_, dayOfWeek) => {
                  const rows = cellEntries(weekIndex, dayOfWeek);
                  const template = weekdayTemplates[dayOfWeek];
                  return (
                    <td
                      key={dayOfWeek}
                      className="min-w-[8.5rem] border-b border-r border-border p-1.5 last:border-r-0"
                    >
                      <ul className="space-y-0.5">
                        <AnimatePresence initial={false}>
                          {rows.map((row) => {
                            const summary = formatExercisePrescriptionSummary({
                              ...row,
                              weightUnit,
                            });
                            const isFadingOut = fadingOutIds.has(row.id);
                            return (
                              <motion.li
                                key={row.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: isFadingOut ? 0 : 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                onAnimationComplete={() => onRowFadeComplete(row.id)}
                                className="group flex items-start gap-1"
                              >
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 rounded px-1 py-0.5 text-left hover:bg-muted/60"
                                  onClick={() =>
                                    setDialog({ mode: 'edit', entry: row, weekIndex, dayOfWeek })
                                  }
                                >
                                  <span className="block leading-snug">
                                    {workoutEntryLabel(row, exerciseMap)}
                                  </span>
                                  {summary ? (
                                    <span className="block text-[11px] text-muted-foreground">
                                      {summary}
                                    </span>
                                  ) : null}
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="invisible h-6 px-1 text-destructive group-hover:visible"
                                  disabled={isFadingOut}
                                  onClick={() => {
                                    if (!template) return;
                                    beginRemoveEntry(row.id, template.id);
                                  }}
                                  aria-label="Remove"
                                >
                                  ×
                                </Button>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ul>
                      <button
                        type="button"
                        className="mt-1 w-full rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        onClick={() => setDialog({ mode: 'add', weekIndex, dayOfWeek })}
                      >
                        + Add
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WorkoutEntryDialog
        open={dialog != null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        mode={dialog?.mode === 'edit' ? 'edit' : 'add'}
        exercises={exercises}
        weightUnit={weightUnit}
        initial={dialog?.mode === 'edit' ? dialog.entry : null}
        weekLabel={dialog ? `Week ${dialog.weekIndex}` : undefined}
        dayLabel={dialog ? WEEKDAYS[dialog.dayOfWeek] : undefined}
        onSubmit={saveEntry}
      />
    </div>
  );
}
