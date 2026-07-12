import type {
  Exercise as ExerciseRow,
  WorkoutTemplate as WorkoutTemplateRow,
  WorkoutTemplateExercise as WorkoutTemplateExerciseRow,
  DayWorkoutSession as DayWorkoutSessionRow,
  DayWorkoutExercise as DayWorkoutExerciseRow,
  WorkoutSetLog as WorkoutSetLogRow,
} from '@calorie-tracker/db';
import { toDateString, toIso } from './serializers';

export function serializeExercise(row: ExerciseRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    notes: row.notes ?? null,
    isGlobal: row.isGlobal,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeWorkoutTemplate(row: WorkoutTemplateRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    scheduleKind: row.scheduleKind,
    dayOfWeek: row.dayOfWeek ?? null,
    intervalDays: row.intervalDays ?? null,
    anchorDate: row.anchorDate ? toDateString(row.anchorDate) : null,
    sortIndex: row.sortIndex,
    isActive: row.isActive === 1,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeWorkoutTemplateExercise(row: WorkoutTemplateExerciseRow) {
  return {
    id: row.id,
    userId: row.userId,
    templateId: row.templateId,
    exerciseId: row.exerciseId,
    sortIndex: row.sortIndex,
    targetSets: row.targetSets,
    repsMin: row.repsMin,
    repsMax: row.repsMax,
    targetWeight: row.targetWeight != null ? Number(row.targetWeight) : null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeDayWorkoutSession(row: DayWorkoutSessionRow) {
  return {
    id: row.id,
    userId: row.userId,
    sessionDate: toDateString(row.sessionDate),
    name: row.name,
    sortIndex: row.sortIndex,
    sourceTemplateId: row.sourceTemplateId ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeDayWorkoutExercise(row: DayWorkoutExerciseRow) {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    sortIndex: row.sortIndex,
    targetSets: row.targetSets,
    repsMin: row.repsMin,
    repsMax: row.repsMax,
    targetWeight: row.targetWeight != null ? Number(row.targetWeight) : null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

export function serializeWorkoutSetLog(row: WorkoutSetLogRow) {
  return {
    id: row.id,
    userId: row.userId,
    dayExerciseId: row.dayExerciseId,
    setIndex: row.setIndex,
    status: row.status,
    targetRepsMin: row.targetRepsMin,
    targetRepsMax: row.targetRepsMax,
    targetWeight: row.targetWeight != null ? Number(row.targetWeight) : null,
    actualReps: row.actualReps ?? null,
    actualWeight: row.actualWeight != null ? Number(row.actualWeight) : null,
    confirmedAt: toIso(row.confirmedAt),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}
