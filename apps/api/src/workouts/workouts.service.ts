import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  dayWorkoutExercises,
  dayWorkoutSessions,
  dailyWorkoutMaterializations,
  workoutSetLogs,
  workoutTemplateExercises,
  workoutTemplates,
  type DbClient,
} from '@calorie-tracker/db';
import {
  resolveEffectiveWorkouts,
  type AddWorkoutSetInput,
  type ConfirmWorkoutSetInput,
  type CreateDayWorkoutExerciseInput,
  type CreateDayWorkoutSessionInput,
  type CreateWorkoutTemplateExerciseInput,
  type CreateWorkoutTemplateInput,
  type UpdateWorkoutSetLogInput,
  type UpdateWorkoutTemplateExerciseInput,
  type UpdateWorkoutTemplateInput,
} from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import {
  serializeDayWorkoutExercise,
  serializeDayWorkoutSession,
  serializeWorkoutSetLog,
  serializeWorkoutTemplate,
  serializeWorkoutTemplateExercise,
} from '../common/workout-serializers';
import { toDateString } from '../common/serializers';

@Injectable()
export class WorkoutsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  // --- Templates ---

  async listTemplates(userId: string) {
    const rows = await this.db.query.workoutTemplates.findMany({
      where: and(eq(workoutTemplates.userId, userId), isNull(workoutTemplates.deletedAt)),
    });
    return rows.map(serializeWorkoutTemplate).sort((a, b) => a.sortIndex - b.sortIndex);
  }

  async getTemplate(userId: string, id: string) {
    const row = await this.db.query.workoutTemplates.findFirst({
      where: and(
        eq(workoutTemplates.id, id),
        eq(workoutTemplates.userId, userId),
        isNull(workoutTemplates.deletedAt),
      ),
    });
    if (!row) throw new NotFoundException('Workout template not found');
    return serializeWorkoutTemplate(row);
  }

  async createTemplate(userId: string, input: CreateWorkoutTemplateInput) {
    const [row] = await this.db
      .insert(workoutTemplates)
      .values({
        userId,
        name: input.name,
        scheduleKind: input.scheduleKind,
        dayOfWeek: input.scheduleKind === 'weekday' ? (input.dayOfWeek ?? 0) : null,
        intervalDays: input.scheduleKind === 'interval' ? (input.intervalDays ?? null) : null,
        anchorDate: input.scheduleKind === 'interval' ? (input.anchorDate ?? null) : null,
        sortIndex: input.sortIndex ?? 0,
        isActive: input.isActive === false ? 0 : 1,
      })
      .returning();
    return serializeWorkoutTemplate(row);
  }

  async updateTemplate(userId: string, id: string, input: UpdateWorkoutTemplateInput) {
    await this.getTemplate(userId, id);
    const [row] = await this.db
      .update(workoutTemplates)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.scheduleKind !== undefined && { scheduleKind: input.scheduleKind }),
        ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
        ...(input.intervalDays !== undefined && { intervalDays: input.intervalDays }),
        ...(input.anchorDate !== undefined && { anchorDate: input.anchorDate }),
        ...(input.sortIndex !== undefined && { sortIndex: input.sortIndex }),
        ...(input.isActive !== undefined && { isActive: input.isActive ? 1 : 0 }),
        updatedAt: new Date(),
      })
      .where(eq(workoutTemplates.id, id))
      .returning();
    return serializeWorkoutTemplate(row);
  }

  async removeTemplate(userId: string, id: string) {
    await this.getTemplate(userId, id);
    const [row] = await this.db
      .update(workoutTemplates)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workoutTemplates.id, id))
      .returning();
    return serializeWorkoutTemplate(row);
  }

  async listTemplateExercises(userId: string, templateId: string) {
    await this.getTemplate(userId, templateId);
    const rows = await this.db.query.workoutTemplateExercises.findMany({
      where: and(
        eq(workoutTemplateExercises.userId, userId),
        eq(workoutTemplateExercises.templateId, templateId),
        isNull(workoutTemplateExercises.deletedAt),
      ),
    });
    return rows.map(serializeWorkoutTemplateExercise).sort((a, b) => a.sortIndex - b.sortIndex);
  }

  async addTemplateExercise(
    userId: string,
    templateId: string,
    input: CreateWorkoutTemplateExerciseInput,
  ) {
    await this.getTemplate(userId, templateId);
    const [row] = await this.db
      .insert(workoutTemplateExercises)
      .values({
        userId,
        templateId,
        exerciseId: input.exerciseId,
        sortIndex: input.sortIndex ?? 0,
        targetSets: input.targetSets,
        repsMin: input.repsMin,
        repsMax: input.repsMax,
        targetWeight: input.targetWeight != null ? String(input.targetWeight) : null,
      })
      .returning();
    return serializeWorkoutTemplateExercise(row);
  }

  async updateTemplateExercise(
    userId: string,
    id: string,
    input: UpdateWorkoutTemplateExerciseInput,
  ) {
    const existing = await this.db.query.workoutTemplateExercises.findFirst({
      where: and(
        eq(workoutTemplateExercises.id, id),
        eq(workoutTemplateExercises.userId, userId),
        isNull(workoutTemplateExercises.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Template exercise not found');

    const [row] = await this.db
      .update(workoutTemplateExercises)
      .set({
        ...(input.exerciseId !== undefined && { exerciseId: input.exerciseId }),
        ...(input.sortIndex !== undefined && { sortIndex: input.sortIndex }),
        ...(input.targetSets !== undefined && { targetSets: input.targetSets }),
        ...(input.repsMin !== undefined && { repsMin: input.repsMin }),
        ...(input.repsMax !== undefined && { repsMax: input.repsMax }),
        ...(input.targetWeight !== undefined && {
          targetWeight: input.targetWeight != null ? String(input.targetWeight) : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(workoutTemplateExercises.id, id))
      .returning();
    return serializeWorkoutTemplateExercise(row);
  }

  async removeTemplateExercise(userId: string, id: string) {
    const existing = await this.db.query.workoutTemplateExercises.findFirst({
      where: and(eq(workoutTemplateExercises.id, id), eq(workoutTemplateExercises.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Template exercise not found');
    const [row] = await this.db
      .update(workoutTemplateExercises)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workoutTemplateExercises.id, id))
      .returning();
    return serializeWorkoutTemplateExercise(row);
  }

  // --- Effective + materialize ---

  private async loadPlanRows(userId: string, date: string) {
    const [templates, templateExercises, sessions, dayExercises, sets] = await Promise.all([
      this.db.query.workoutTemplates.findMany({
        where: and(eq(workoutTemplates.userId, userId), isNull(workoutTemplates.deletedAt)),
      }),
      this.db.query.workoutTemplateExercises.findMany({
        where: and(
          eq(workoutTemplateExercises.userId, userId),
          isNull(workoutTemplateExercises.deletedAt),
        ),
      }),
      this.db.query.dayWorkoutSessions.findMany({
        where: and(
          eq(dayWorkoutSessions.userId, userId),
          eq(dayWorkoutSessions.sessionDate, date),
          isNull(dayWorkoutSessions.deletedAt),
        ),
      }),
      this.db.query.dayWorkoutExercises.findMany({
        where: and(eq(dayWorkoutExercises.userId, userId), isNull(dayWorkoutExercises.deletedAt)),
      }),
      this.db.query.workoutSetLogs.findMany({
        where: and(eq(workoutSetLogs.userId, userId), isNull(workoutSetLogs.deletedAt)),
      }),
    ]);

    return {
      templates: templates.map(serializeWorkoutTemplate),
      templateExercises: templateExercises.map(serializeWorkoutTemplateExercise),
      sessions: sessions.map(serializeDayWorkoutSession),
      dayExercises: dayExercises.map(serializeDayWorkoutExercise),
      sets: sets.map(serializeWorkoutSetLog),
    };
  }

  async getEffective(userId: string, date: string) {
    const rows = await this.loadPlanRows(userId, date);
    return resolveEffectiveWorkouts(
      date,
      rows.templates,
      rows.templateExercises,
      rows.sessions,
      rows.dayExercises,
      rows.sets,
    );
  }

  async materialize(userId: string, date: string) {
    const existingSessions = await this.db.query.dayWorkoutSessions.findMany({
      where: and(
        eq(dayWorkoutSessions.userId, userId),
        eq(dayWorkoutSessions.sessionDate, date),
        isNull(dayWorkoutSessions.deletedAt),
      ),
    });

    if (existingSessions.length === 0) {
      const effective = await this.getEffective(userId, date);
      if (effective.source === 'template') {
        for (const [index, session] of effective.sessions.entries()) {
          const [daySession] = await this.db
            .insert(dayWorkoutSessions)
            .values({
              userId,
              sessionDate: date,
              name: session.name,
              sortIndex: session.sortIndex ?? index,
              sourceTemplateId: session.sourceTemplateId ?? session.id,
            })
            .returning();

          for (const ex of session.exercises) {
            const [dayEx] = await this.db
              .insert(dayWorkoutExercises)
              .values({
                userId,
                sessionId: daySession.id,
                exerciseId: ex.exerciseId,
                sortIndex: ex.sortIndex,
                targetSets: ex.targetSets,
                repsMin: ex.repsMin,
                repsMax: ex.repsMax,
                targetWeight: ex.targetWeight != null ? String(ex.targetWeight) : null,
              })
              .returning();

            for (let i = 0; i < ex.targetSets; i++) {
              await this.db.insert(workoutSetLogs).values({
                userId,
                dayExerciseId: dayEx.id,
                setIndex: i,
                status: 'pending',
                targetRepsMin: ex.repsMin,
                targetRepsMax: ex.repsMax,
                targetWeight: ex.targetWeight != null ? String(ex.targetWeight) : null,
              });
            }
          }
        }
      }
    } else {
      // Ensure sets exist for day exercises
      const dayExRows = await this.db.query.dayWorkoutExercises.findMany({
        where: and(
          eq(dayWorkoutExercises.userId, userId),
          isNull(dayWorkoutExercises.deletedAt),
        ),
      });
      const sessionIds = new Set(existingSessions.map((s) => s.id));
      for (const ex of dayExRows.filter((e) => sessionIds.has(e.sessionId))) {
        const existingSets = await this.db.query.workoutSetLogs.findMany({
          where: and(
            eq(workoutSetLogs.dayExerciseId, ex.id),
            eq(workoutSetLogs.userId, userId),
            isNull(workoutSetLogs.deletedAt),
          ),
        });
        if (existingSets.length === 0) {
          for (let i = 0; i < ex.targetSets; i++) {
            await this.db.insert(workoutSetLogs).values({
              userId,
              dayExerciseId: ex.id,
              setIndex: i,
              status: 'pending',
              targetRepsMin: ex.repsMin,
              targetRepsMax: ex.repsMax,
              targetWeight: ex.targetWeight != null ? String(ex.targetWeight) : null,
            });
          }
        }
      }
    }

    const materialized = await this.db.query.dailyWorkoutMaterializations.findFirst({
      where: and(
        eq(dailyWorkoutMaterializations.userId, userId),
        eq(dailyWorkoutMaterializations.sessionDate, date),
      ),
    });
    if (!materialized) {
      await this.db.insert(dailyWorkoutMaterializations).values({
        userId,
        sessionDate: date,
      });
    }

    return this.getEffective(userId, date);
  }

  async resetToTemplate(userId: string, date: string) {
    const sessions = await this.db.query.dayWorkoutSessions.findMany({
      where: and(
        eq(dayWorkoutSessions.userId, userId),
        eq(dayWorkoutSessions.sessionDate, date),
        isNull(dayWorkoutSessions.deletedAt),
      ),
    });

    for (const session of sessions) {
      const dayExs = await this.db.query.dayWorkoutExercises.findMany({
        where: and(
          eq(dayWorkoutExercises.sessionId, session.id),
          isNull(dayWorkoutExercises.deletedAt),
        ),
      });
      for (const ex of dayExs) {
        await this.db
          .update(workoutSetLogs)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(workoutSetLogs.dayExerciseId, ex.id));
        await this.db
          .update(dayWorkoutExercises)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(dayWorkoutExercises.id, ex.id));
      }
      await this.db
        .update(dayWorkoutSessions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(dayWorkoutSessions.id, session.id));
    }

    await this.db
      .delete(dailyWorkoutMaterializations)
      .where(
        and(
          eq(dailyWorkoutMaterializations.userId, userId),
          eq(dailyWorkoutMaterializations.sessionDate, date),
        ),
      );

    return this.materialize(userId, date);
  }

  // --- Day edits ---

  async createSession(userId: string, input: CreateDayWorkoutSessionInput) {
    await this.materialize(userId, input.sessionDate);
    const [row] = await this.db
      .insert(dayWorkoutSessions)
      .values({
        userId,
        sessionDate: input.sessionDate,
        name: input.name,
        sortIndex: input.sortIndex ?? 0,
      })
      .returning();
    return serializeDayWorkoutSession(row);
  }

  async removeSession(userId: string, id: string) {
    const session = await this.db.query.dayWorkoutSessions.findFirst({
      where: and(
        eq(dayWorkoutSessions.id, id),
        eq(dayWorkoutSessions.userId, userId),
        isNull(dayWorkoutSessions.deletedAt),
      ),
    });
    if (!session) throw new NotFoundException('Session not found');

    const dayExs = await this.db.query.dayWorkoutExercises.findMany({
      where: and(eq(dayWorkoutExercises.sessionId, id), isNull(dayWorkoutExercises.deletedAt)),
    });
    for (const ex of dayExs) {
      await this.db
        .update(workoutSetLogs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(workoutSetLogs.dayExerciseId, ex.id));
      await this.db
        .update(dayWorkoutExercises)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(dayWorkoutExercises.id, ex.id));
    }
    const [row] = await this.db
      .update(dayWorkoutSessions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dayWorkoutSessions.id, id))
      .returning();
    return serializeDayWorkoutSession(row);
  }

  async addDayExercise(userId: string, sessionId: string, input: CreateDayWorkoutExerciseInput) {
    const session = await this.db.query.dayWorkoutSessions.findFirst({
      where: and(
        eq(dayWorkoutSessions.id, sessionId),
        eq(dayWorkoutSessions.userId, userId),
        isNull(dayWorkoutSessions.deletedAt),
      ),
    });
    if (!session) {
      throw new BadRequestException('Materialize the day first before editing exercises');
    }

    const [dayEx] = await this.db
      .insert(dayWorkoutExercises)
      .values({
        userId,
        sessionId,
        exerciseId: input.exerciseId,
        sortIndex: input.sortIndex ?? 0,
        targetSets: input.targetSets,
        repsMin: input.repsMin,
        repsMax: input.repsMax,
        targetWeight: input.targetWeight != null ? String(input.targetWeight) : null,
      })
      .returning();

    for (let i = 0; i < input.targetSets; i++) {
      await this.db.insert(workoutSetLogs).values({
        userId,
        dayExerciseId: dayEx.id,
        setIndex: i,
        status: 'pending',
        targetRepsMin: input.repsMin,
        targetRepsMax: input.repsMax,
        targetWeight: input.targetWeight != null ? String(input.targetWeight) : null,
      });
    }

    return serializeDayWorkoutExercise(dayEx);
  }

  async removeDayExercise(userId: string, id: string) {
    const existing = await this.db.query.dayWorkoutExercises.findFirst({
      where: and(
        eq(dayWorkoutExercises.id, id),
        eq(dayWorkoutExercises.userId, userId),
        isNull(dayWorkoutExercises.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Day exercise not found');

    await this.db
      .update(workoutSetLogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workoutSetLogs.dayExerciseId, id));
    const [row] = await this.db
      .update(dayWorkoutExercises)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dayWorkoutExercises.id, id))
      .returning();
    return serializeDayWorkoutExercise(row);
  }

  async addSet(userId: string, dayExerciseId: string, input: AddWorkoutSetInput = {}) {
    const ex = await this.db.query.dayWorkoutExercises.findFirst({
      where: and(
        eq(dayWorkoutExercises.id, dayExerciseId),
        eq(dayWorkoutExercises.userId, userId),
        isNull(dayWorkoutExercises.deletedAt),
      ),
    });
    if (!ex) throw new NotFoundException('Day exercise not found');

    const existing = await this.db.query.workoutSetLogs.findMany({
      where: and(
        eq(workoutSetLogs.dayExerciseId, dayExerciseId),
        isNull(workoutSetLogs.deletedAt),
      ),
    });
    const nextIndex = existing.reduce((max, s) => Math.max(max, s.setIndex), -1) + 1;
    const repsMin = input.targetRepsMin ?? ex.repsMin;
    const repsMax = input.targetRepsMax ?? ex.repsMax;
    const weight =
      input.targetWeight !== undefined
        ? input.targetWeight
        : ex.targetWeight != null
          ? Number(ex.targetWeight)
          : null;

    const [row] = await this.db
      .insert(workoutSetLogs)
      .values({
        userId,
        dayExerciseId,
        setIndex: nextIndex,
        status: 'pending',
        targetRepsMin: repsMin,
        targetRepsMax: repsMax,
        targetWeight: weight != null ? String(weight) : null,
      })
      .returning();

    await this.db
      .update(dayWorkoutExercises)
      .set({ targetSets: existing.length + 1, updatedAt: new Date() })
      .where(eq(dayWorkoutExercises.id, dayExerciseId));

    return serializeWorkoutSetLog(row);
  }

  async removeSet(userId: string, id: string) {
    const existing = await this.db.query.workoutSetLogs.findFirst({
      where: and(
        eq(workoutSetLogs.id, id),
        eq(workoutSetLogs.userId, userId),
        isNull(workoutSetLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Set not found');
    const [row] = await this.db
      .update(workoutSetLogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workoutSetLogs.id, id))
      .returning();
    return serializeWorkoutSetLog(row);
  }

  async updateSet(userId: string, id: string, input: UpdateWorkoutSetLogInput) {
    const existing = await this.db.query.workoutSetLogs.findFirst({
      where: and(
        eq(workoutSetLogs.id, id),
        eq(workoutSetLogs.userId, userId),
        isNull(workoutSetLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Set not found');

    const [row] = await this.db
      .update(workoutSetLogs)
      .set({
        ...(input.actualReps !== undefined && { actualReps: input.actualReps }),
        ...(input.actualWeight !== undefined && {
          actualWeight: input.actualWeight != null ? String(input.actualWeight) : null,
        }),
        ...(input.targetRepsMin !== undefined && { targetRepsMin: input.targetRepsMin }),
        ...(input.targetRepsMax !== undefined && { targetRepsMax: input.targetRepsMax }),
        ...(input.targetWeight !== undefined && {
          targetWeight: input.targetWeight != null ? String(input.targetWeight) : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(workoutSetLogs.id, id))
      .returning();
    return serializeWorkoutSetLog(row);
  }

  async confirmSet(userId: string, id: string, input: ConfirmWorkoutSetInput = {}) {
    const existing = await this.db.query.workoutSetLogs.findFirst({
      where: and(
        eq(workoutSetLogs.id, id),
        eq(workoutSetLogs.userId, userId),
        isNull(workoutSetLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Set not found');

    const actualReps =
      input.actualReps ?? existing.actualReps ?? existing.targetRepsMax ?? existing.targetRepsMin;
    const actualWeight =
      input.actualWeight !== undefined
        ? input.actualWeight
        : existing.actualWeight != null
          ? Number(existing.actualWeight)
          : existing.targetWeight != null
            ? Number(existing.targetWeight)
            : null;

    const [row] = await this.db
      .update(workoutSetLogs)
      .set({
        status: 'confirmed',
        actualReps,
        actualWeight: actualWeight != null ? String(actualWeight) : null,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workoutSetLogs.id, id))
      .returning();
    return serializeWorkoutSetLog(row);
  }

  async unconfirmSet(userId: string, id: string) {
    const existing = await this.db.query.workoutSetLogs.findFirst({
      where: and(
        eq(workoutSetLogs.id, id),
        eq(workoutSetLogs.userId, userId),
        isNull(workoutSetLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Set not found');
    const [row] = await this.db
      .update(workoutSetLogs)
      .set({
        status: 'pending',
        confirmedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(workoutSetLogs.id, id))
      .returning();
    return serializeWorkoutSetLog(row);
  }

  /** Ensure day rows exist when editing from a live template view. */
  async ensureDayOverride(userId: string, date: string) {
    return this.materialize(userId, date);
  }

  sessionDateOf(row: { sessionDate: string | Date }) {
    return toDateString(row.sessionDate);
  }
}
