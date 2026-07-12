import { parseCalendarDate, formatCalendarDate } from './date-utils';
import { dayOfWeekFromDate } from './macro-target-utils';
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
  exerciseId: string;
  sortIndex: number;
  targetSets: number;
  repsMin: number;
  repsMax: number;
  targetWeight?: number | null;
  deletedAt?: string | null;
};

export type EffectiveWorkoutExercise = {
  id: string;
  exerciseId: string;
  sortIndex: number;
  targetSets: number;
  repsMin: number;
  repsMax: number;
  targetWeight?: number | null;
  sets: WorkoutSetLog[];
  source: 'override' | 'template';
};

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
): EffectiveWorkouts {
  const activeSessions = daySessions.filter((s) => !s.deletedAt && s.sessionDate === date);
  const activeDayExercises = dayExercises.filter((e) => !e.deletedAt);
  const activeSets = setLogs.filter((s) => !s.deletedAt);

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
            exerciseId: ex.exerciseId,
            sortIndex: ex.sortIndex,
            targetSets: ex.targetSets,
            repsMin: ex.repsMin,
            repsMax: ex.repsMax,
            targetWeight: ex.targetWeight ?? null,
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
        exerciseId: ex.exerciseId,
        sortIndex: ex.sortIndex,
        targetSets: ex.targetSets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        targetWeight: ex.targetWeight ?? null,
        source: 'template' as const,
        sets: [],
      })),
  }));

  return { source: 'template', sessions };
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
