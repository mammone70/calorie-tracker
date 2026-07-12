import { z } from 'zod';
import { WORKOUT_SET_STATUSES } from '../constants';

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

export const createDayWorkoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  sortIndex: z.number().int().min(0).default(0),
  targetSets: z.number().int().min(1).max(50),
  repsMin: z.number().int().min(0).max(999),
  repsMax: z.number().int().min(0).max(999),
  targetWeight: z.number().nonnegative().nullable().optional(),
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
export type CreateDayWorkoutSessionInput = z.infer<typeof createDayWorkoutSessionSchema>;
export type AddWorkoutSetInput = z.infer<typeof addWorkoutSetSchema>;
