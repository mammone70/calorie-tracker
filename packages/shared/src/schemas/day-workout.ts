import { z } from 'zod';
import { BODY_PARTS, PRESCRIPTION_KINDS, WORKOUT_SET_STATUSES } from '../constants';
import { refinePrescription, refineWorkoutEntryTarget } from './workout-template';
export const workoutSetLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  dayExerciseId: z.string().uuid(),
  setIndex: z.number().int(),
  status: z.enum(WORKOUT_SET_STATUSES),
  targetRepsMin: z.number().int(),
  targetRepsMax: z.number().int(),
  targetWeight: z.number().nullable().optional(),
  actualReps: z.number().int().nullable().optional(),
  actualWeight: z.number().nullable().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const updateWorkoutSetLogSchema = z.object({
  actualReps: z.number().int().min(0).max(999).optional(),
  actualWeight: z.number().nonnegative().nullable().optional(),
  targetRepsMin: z.number().int().min(0).max(999).optional(),
  targetRepsMax: z.number().int().min(0).max(999).optional(),
  targetWeight: z.number().nonnegative().nullable().optional(),
});

export const confirmWorkoutSetSchema = z.object({
  actualReps: z.number().int().min(0).max(999).optional(),
  actualWeight: z.number().nonnegative().nullable().optional(),
});

export const createDayWorkoutExerciseSchema = z
  .object({
    exerciseId: z.string().uuid().nullable().optional(),
    bodyPart: z.enum(BODY_PARTS).nullable().optional(),
    weekIndex: z.number().int().min(1).max(52).default(1),
    sortIndex: z.number().int().min(0).default(0),
    targetSets: z.number().int().min(1).max(50).nullable().optional(),
    repsMin: z.number().int().min(0).max(999).nullable().optional(),
    repsMax: z.number().int().min(0).max(999).nullable().optional(),
    targetWeight: z.number().nonnegative().nullable().optional(),
    prescriptionKind: z.enum(PRESCRIPTION_KINDS).default('none'),
    prescriptionValue: z.number().nonnegative().nullable().optional(),
  })
  .superRefine(refinePrescription)
  .superRefine(refineWorkoutEntryTarget);

export const dayWorkoutExerciseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid().nullable(),
  bodyPart: z.string().nullable(),
  weekIndex: z.number().int(),
  sortIndex: z.number().int(),
  targetSets: z.number().int().nullable(),
  repsMin: z.number().int().nullable(),
  repsMax: z.number().int().nullable(),
  targetWeight: z.number().nullable().optional(),
  prescriptionKind: z.enum(PRESCRIPTION_KINDS),
  prescriptionValue: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const createDayWorkoutSessionSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(200),
  sortIndex: z.number().int().min(0).default(0),
});

export const addWorkoutSetSchema = z.object({
  targetRepsMin: z.number().int().min(0).max(999).optional(),
  targetRepsMax: z.number().int().min(0).max(999).optional(),
  targetWeight: z.number().nonnegative().nullable().optional(),
});

export const materializeWorkoutsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const effectiveWorkoutsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forUserId: z.string().uuid().optional(),
});

export type WorkoutSetLog = z.infer<typeof workoutSetLogSchema>;
export type UpdateWorkoutSetLogInput = z.infer<typeof updateWorkoutSetLogSchema>;
export type ConfirmWorkoutSetInput = z.infer<typeof confirmWorkoutSetSchema>;
export type CreateDayWorkoutExerciseInput = z.infer<typeof createDayWorkoutExerciseSchema>;
export type DayWorkoutExercise = z.infer<typeof dayWorkoutExerciseSchema>;
export type CreateDayWorkoutSessionInput = z.infer<typeof createDayWorkoutSessionSchema>;
export type AddWorkoutSetInput = z.infer<typeof addWorkoutSetSchema>;
