import { parseCalendarDate, formatCalendarDate } from './date-utils';
import { dayOfWeekFromDate } from './macro-target-utils';
import type { PrescriptionKind, WeightUnit } from './constants';
import type { WorkoutTemplate, WorkoutTemplateExercise } from './schemas/workout-template';
import type { WorkoutSetLog } from './schemas/day-workout';

export type DayWorkoutSessionLike = {
  id: string;
  sessionDate: string;
  name: string;
  sortIndex: number;
  sourceTemplateId?: string | null;
  deletedAt?: string | null;
};

export type DayWorkoutExerciseLike = {
  id: string;
  sessionId: string;
  exerciseId?: string | null;
  bodyPart?: string | null;
  weekIndex?: number;
  sortIndex: number;
  targetSets?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  targetWeight?: number | null;
  prescriptionKind?: PrescriptionKind;
  prescriptionValue?: number | null;
  deletedAt?: string | null;
};

export type EffectiveWorkoutExercise = {
  id: string;
  exerciseId: string | null;
  bodyPart: string | null;
  weekIndex: number;
  sortIndex: number;
  targetSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  targetWeight?: number | null;
  prescriptionKind: PrescriptionKind;
  prescriptionValue?: number | null;
  sets: WorkoutSetLog[];
  source: 'override' | 'template';
};

/** 1-based program week for a calendar date within a lifting block. */
export function programWeekIndex(
  date: string,
  blockStart: string | null | undefined,
  weekCount: number,
): number {
  const count = Math.max(1, weekCount || 1);
  if (!blockStart || date < blockStart) return 1;
  const week = Math.floor(calendarDaysBetween(blockStart, date) / 7) + 1;
  return Math.min(Math.max(week, 1), count);
}

export function workoutEntryLabel(
  entry: { exerciseId?: string | null; bodyPart?: string | null },
  exerciseNameById?: Map<string, string> | Record<string, { name: string }>,
): string {
  if (entry.bodyPart) return entry.bodyPart;
  if (!entry.exerciseId) return 'Exercise';
  if (exerciseNameById instanceof Map) {
    return exerciseNameById.get(entry.exerciseId) ?? 'Exercise';
  }
  return exerciseNameById?.[entry.exerciseId]?.name ?? 'Exercise';
}

export type EffectiveWorkoutSession = {
  id: string;
  name: string;
  sortIndex: number;
  sourceTemplateId?: string | null;
  source: 'override' | 'template';
  exercises: EffectiveWorkoutExercise[];
};

export type EffectiveWorkouts = {
  source: 'override' | 'template' | 'none';
  sessions: EffectiveWorkoutSession[];
};

export function templateMatchesDate(template: WorkoutTemplate, date: string): boolean {
  if (!template.isActive || template.deletedAt) return false;

  if (template.scheduleKind === 'weekday') {
    return template.dayOfWeek === dayOfWeekFromDate(date);
  }

  if (template.scheduleKind === 'interval') {
    if (!template.intervalDays || !template.anchorDate) return false;
    if (date < template.anchorDate) return false;
    const start = parseCalendarDate(template.anchorDate);
    const current = parseCalendarDate(date);
    const diffDays = Math.round((current.getTime() - start.getTime()) / 86_400_000);
    return diffDays % template.intervalDays === 0;
  }

  return false;
}

export function resolveEffectiveWorkouts(
  date: string,
  templates: WorkoutTemplate[],
  templateExercises: WorkoutTemplateExercise[],
  daySessions: DayWorkoutSessionLike[],
  dayExercises: DayWorkoutExerciseLike[],
  setLogs: WorkoutSetLog[],
  block?: { startDate?: string | null; weekCount?: number } | null,
): EffectiveWorkouts {
  const activeSessions = daySessions.filter((s) => !s.deletedAt && s.sessionDate === date);
  const activeDayExercises = dayExercises.filter((e) => !e.deletedAt);
  const activeSets = setLogs.filter((s) => !s.deletedAt);
  const weekCount = Math.max(
    1,
    block?.weekCount ??
      templateExercises.reduce((max, ex) => Math.max(max, ex.weekIndex ?? 1), 1),
  );
  const activeWeek = programWeekIndex(date, block?.startDate, weekCount);

  if (activeSessions.length > 0) {
    const exercisesBySession = new Map<string, DayWorkoutExerciseLike[]>();
    for (const ex of activeDayExercises) {
      const list = exercisesBySession.get(ex.sessionId) ?? [];
      list.push(ex);
      exercisesBySession.set(ex.sessionId, list);
    }

    const setsByExercise = new Map<string, WorkoutSetLog[]>();
    for (const set of activeSets) {
      const list = setsByExercise.get(set.dayExerciseId) ?? [];
      list.push(set);
      setsByExercise.set(set.dayExerciseId, list);
    }

    const sessions: EffectiveWorkoutSession[] = [...activeSessions]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((session) => ({
        id: session.id,
        name: session.name,
        sortIndex: session.sortIndex,
        sourceTemplateId: session.sourceTemplateId ?? null,
        source: 'override' as const,
        exercises: (exercisesBySession.get(session.id) ?? [])
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .map((ex) => ({
            id: ex.id,
            exerciseId: ex.exerciseId ?? null,
            bodyPart: ex.bodyPart ?? null,
            weekIndex: ex.weekIndex ?? 1,
            sortIndex: ex.sortIndex,
            targetSets: ex.targetSets ?? null,
            repsMin: ex.repsMin ?? null,
            repsMax: ex.repsMax ?? null,
            targetWeight: ex.targetWeight ?? null,
            prescriptionKind: ex.prescriptionKind ?? 'none',
            prescriptionValue: ex.prescriptionValue ?? null,
            source: 'override' as const,
            sets: (setsByExercise.get(ex.id) ?? []).sort((a, b) => a.setIndex - b.setIndex),
          })),
      }));

    return { source: 'override', sessions };
  }

  const matching = templates
    .filter((t) => templateMatchesDate(t, date))
    .sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name));

  if (matching.length === 0) {
    return { source: 'none', sessions: [] };
  }

  const exercisesByTemplate = new Map<string, WorkoutTemplateExercise[]>();
  for (const ex of templateExercises.filter((e) => !e.deletedAt)) {
    const week = ex.weekIndex ?? 1;
    // Multi-week boards only surface the active program week; legacy single-week
    // rows (all weekIndex 1) still appear every week.
    if (weekCount > 1 && week !== activeWeek) continue;
    const list = exercisesByTemplate.get(ex.templateId) ?? [];
    list.push(ex);
    exercisesByTemplate.set(ex.templateId, list);
  }

  const sessions: EffectiveWorkoutSession[] = matching.map((template, index) => ({
    id: template.id,
    name: template.name,
    sortIndex: template.sortIndex ?? index,
    sourceTemplateId: template.id,
    source: 'template' as const,
    exercises: (exercisesByTemplate.get(template.id) ?? [])
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId ?? null,
        bodyPart: ex.bodyPart ?? null,
        weekIndex: ex.weekIndex ?? 1,
        sortIndex: ex.sortIndex,
        targetSets: ex.targetSets ?? null,
        repsMin: ex.repsMin ?? null,
        repsMax: ex.repsMax ?? null,
        targetWeight: ex.targetWeight ?? null,
        prescriptionKind: ex.prescriptionKind ?? 'none',
        prescriptionValue: ex.prescriptionValue ?? null,
        source: 'template' as const,
        sets: [],
      })),
  }));

  return { source: 'template', sessions };
}

export function formatPrescription(
  kind: PrescriptionKind | null | undefined,
  value: number | null | undefined,
  weightUnit: WeightUnit = 'lbs',
): string {
  if (!kind || kind === 'none' || value == null) return '';
  if (kind === 'rpe') return `RPE ${value}`;
  if (kind === 'rir') return `RIR ${value}`;
  if (kind === 'load_increase') return `+${value} ${weightUnit}`;
  return '';
}

export function formatExercisePrescriptionSummary(input: {
  targetSets?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  targetWeight?: number | null;
  prescriptionKind?: PrescriptionKind | null;
  prescriptionValue?: number | null;
  weightUnit?: WeightUnit;
}): string {
  const parts: string[] = [];
  if (input.targetSets != null && input.repsMin != null && input.repsMax != null) {
    const reps =
      input.repsMax !== input.repsMin
        ? `${input.repsMin}–${input.repsMax}`
        : String(input.repsMin);
    parts.push(`${input.targetSets} × ${reps}`);
  } else if (input.targetSets != null) {
    parts.push(`${input.targetSets} sets`);
  } else if (input.repsMin != null && input.repsMax != null) {
    const reps =
      input.repsMax !== input.repsMin
        ? `${input.repsMin}–${input.repsMax}`
        : String(input.repsMin);
    parts.push(`${reps} reps`);
  }
  if (input.targetWeight != null) {
    parts.push(`@ ${input.targetWeight}${input.weightUnit ? ` ${input.weightUnit}` : ''}`);
  }
  const prescription = formatPrescription(
    input.prescriptionKind,
    input.prescriptionValue,
    input.weightUnit ?? 'lbs',
  );
  if (prescription) parts.push(prescription);
  return parts.join(' ');
}

/** Days between two YYYY-MM-DD dates (calendar). */
export function calendarDaysBetween(from: string, to: string): number {
  const a = parseCalendarDate(from);
  const b = parseCalendarDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addCalendarDays(date: string, days: number): string {
  const d = parseCalendarDate(date);
  d.setDate(d.getDate() + days);
  return formatCalendarDate(d);
}
