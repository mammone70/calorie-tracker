import { z } from 'zod';
import {
  BODY_PARTS,
  PRESCRIPTION_KINDS,
  WORKOUT_SCHEDULE_KINDS,
  type PrescriptionKind,
} from '../constants';

const repsRangeRefine = (
  data: { repsMin?: number | null; repsMax?: number | null },
  ctx: z.RefinementCtx,
) => {
  const hasMin = data.repsMin != null;
  const hasMax = data.repsMax != null;
  if (hasMin !== hasMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide both repsMin and repsMax, or neither',
      path: hasMin ? ['repsMax'] : ['repsMin'],
    });
    return;
  }
  if (hasMin && hasMax && (data.repsMax as number) < (data.repsMin as number)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'repsMax must be >= repsMin',
      path: ['repsMax'],
    });
  }
};

export function refinePrescription(
  data: { prescriptionKind?: PrescriptionKind; prescriptionValue?: number | null },
  ctx: z.RefinementCtx,
) {
  const kind = data.prescriptionKind ?? 'none';
  const value = data.prescriptionValue;

  if (kind === 'none') {
    if (value != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'prescriptionValue must be empty when kind is none',
        path: ['prescriptionValue'],
      });
    }
    return;
  }

  if (value == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'prescriptionValue is required',
      path: ['prescriptionValue'],
    });
    return;
  }

  if (kind === 'rpe' && (value < 1 || value > 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'RPE must be between 1 and 10',
      path: ['prescriptionValue'],
    });
  }

  if (kind === 'rir' && (value < 0 || value > 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'RIR must be between 0 and 10',
      path: ['prescriptionValue'],
    });
  }

  if (kind === 'load_increase' && value <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Load increase must be greater than 0',
      path: ['prescriptionValue'],
    });
  }
}

const bodyPartSchema = z.enum(BODY_PARTS);

export function refineWorkoutEntryTarget(
  data: { exerciseId?: string | null; bodyPart?: string | null },
  ctx: z.RefinementCtx,
) {
  const hasExercise = data.exerciseId != null && data.exerciseId !== '';
  const hasBodyPart = data.bodyPart != null && data.bodyPart !== '';
  if (hasExercise === hasBodyPart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either an exercise or a body part (not both)',
      path: hasExercise ? ['bodyPart'] : ['exerciseId'],
    });
  }
}

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

export const updateWorkoutTemplateSchema = z.object({
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
    exerciseId: z.string().uuid().nullable().optional(),
    bodyPart: bodyPartSchema.nullable().optional(),
    weekIndex: z.number().int().min(1).max(52).default(1),
    sortIndex: z.number().int().min(0).default(0),
    targetSets: z.number().int().min(1).max(50).nullable().optional(),
    repsMin: z.number().int().min(0).max(999).nullable().optional(),
    repsMax: z.number().int().min(0).max(999).nullable().optional(),
    targetWeight: z.number().nonnegative().nullable().optional(),
    prescriptionKind: z.enum(PRESCRIPTION_KINDS).default('none'),
    prescriptionValue: z.number().nonnegative().nullable().optional(),
  })
  .superRefine(repsRangeRefine)
  .superRefine(refinePrescription)
  .superRefine(refineWorkoutEntryTarget);

export const updateWorkoutTemplateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid().nullable().optional(),
    bodyPart: bodyPartSchema.nullable().optional(),
    weekIndex: z.number().int().min(1).max(52).optional(),
    sortIndex: z.number().int().min(0).optional(),
    targetSets: z.number().int().min(1).max(50).nullable().optional(),
    repsMin: z.number().int().min(0).max(999).nullable().optional(),
    repsMax: z.number().int().min(0).max(999).nullable().optional(),
    targetWeight: z.number().nonnegative().nullable().optional(),
    prescriptionKind: z.enum(PRESCRIPTION_KINDS).optional(),
    prescriptionValue: z.number().nonnegative().nullable().optional(),
  })
  .superRefine(repsRangeRefine)
  .superRefine(refinePrescription)
  .superRefine((data, ctx) => {
    // Only validate entry target when the client is changing it.
    if (data.exerciseId === undefined && data.bodyPart === undefined) return;
    refineWorkoutEntryTarget(
      {
        exerciseId: data.exerciseId ?? null,
        bodyPart: data.bodyPart ?? null,
      },
      ctx,
    );
  });

export const workoutTemplateExerciseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  templateId: z.string().uuid(),
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

export const workoutBlockSchema = z.object({
  userId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  weekCount: z.number().int().min(1).max(52),
  updatedAt: z.string().datetime(),
});

export const updateWorkoutBlockSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  weekCount: z.number().int().min(1).max(52).optional(),
});

export type CreateWorkoutTemplateInput = z.infer<typeof createWorkoutTemplateSchema>;
export type UpdateWorkoutTemplateInput = z.infer<typeof updateWorkoutTemplateSchema>;
export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;
export type CreateWorkoutTemplateExerciseInput = z.infer<typeof createWorkoutTemplateExerciseSchema>;
export type UpdateWorkoutTemplateExerciseInput = z.infer<typeof updateWorkoutTemplateExerciseSchema>;
export type WorkoutTemplateExercise = z.infer<typeof workoutTemplateExerciseSchema>;
export type WorkoutBlock = z.infer<typeof workoutBlockSchema>;
export type UpdateWorkoutBlockInput = z.infer<typeof updateWorkoutBlockSchema>;
