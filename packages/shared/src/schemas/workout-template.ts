import { z } from 'zod';
import { WORKOUT_SCHEDULE_KINDS } from '../constants';

const repsRangeRefine = (data: { repsMin: number; repsMax: number }, ctx: z.RefinementCtx) => {
  if (data.repsMax < data.repsMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'repsMax must be >= repsMin',
      path: ['repsMax'],
    });
  }
};

export const createWorkoutTemplateSchema = z
  .object({
    name: z.string().min(1).max(200),
    scheduleKind: z.enum(WORKOUT_SCHEDULE_KINDS),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    intervalDays: z.number().int().min(1).max(365).optional().nullable(),
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    sortIndex: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === 'weekday' && (data.dayOfWeek === null || data.dayOfWeek === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'dayOfWeek required', path: ['dayOfWeek'] });
    }
    if (data.scheduleKind === 'interval') {
      if (!data.intervalDays) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'intervalDays required',
          path: ['intervalDays'],
        });
      }
      if (!data.anchorDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'anchorDate required',
          path: ['anchorDate'],
        });
      }
    }
  });

export const updateWorkoutTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    scheduleKind: z.enum(WORKOUT_SCHEDULE_KINDS).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    intervalDays: z.number().int().min(1).max(365).optional().nullable(),
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    sortIndex: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  });

export const workoutTemplateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  scheduleKind: z.enum(WORKOUT_SCHEDULE_KINDS),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  intervalDays: z.number().int().nullable(),
  anchorDate: z.string().nullable(),
  sortIndex: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const createWorkoutTemplateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid(),
    sortIndex: z.number().int().min(0).default(0),
    targetSets: z.number().int().min(1).max(50),
    repsMin: z.number().int().min(0).max(999),
    repsMax: z.number().int().min(0).max(999),
    targetWeight: z.number().nonnegative().nullable().optional(),
  })
  .superRefine(repsRangeRefine);

export const updateWorkoutTemplateExerciseSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  sortIndex: z.number().int().min(0).optional(),
  targetSets: z.number().int().min(1).max(50).optional(),
  repsMin: z.number().int().min(0).max(999).optional(),
  repsMax: z.number().int().min(0).max(999).optional(),
  targetWeight: z.number().nonnegative().nullable().optional(),
});

export const workoutTemplateExerciseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  sortIndex: z.number().int(),
  targetSets: z.number().int(),
  repsMin: z.number().int(),
  repsMax: z.number().int(),
  targetWeight: z.number().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type CreateWorkoutTemplateInput = z.infer<typeof createWorkoutTemplateSchema>;
export type UpdateWorkoutTemplateInput = z.infer<typeof updateWorkoutTemplateSchema>;
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;
export type CreateWorkoutTemplateExerciseInput = z.infer<typeof createWorkoutTemplateExerciseSchema>;
export type UpdateWorkoutTemplateExerciseInput = z.infer<typeof updateWorkoutTemplateExerciseSchema>;
export type WorkoutTemplateExercise = z.infer<typeof workoutTemplateExerciseSchema>;
