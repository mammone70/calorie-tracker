import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, isNull, or } from 'drizzle-orm';
import { exercises, type DbClient } from '@calorie-tracker/db';
import type { CreateExerciseInput, UpdateExerciseInput, UserRole } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeExercise } from '../common/workout-serializers';

@Injectable()
export class ExercisesService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  private visibleToUser(userId: string) {
    return and(
      isNull(exercises.deletedAt),
      or(eq(exercises.isGlobal, true), eq(exercises.userId, userId)),
    );
  }

  async findAll(userId: string) {
    const rows = await this.db.query.exercises.findMany({
      where: this.visibleToUser(userId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return rows.map(serializeExercise);
  }

  async search(userId: string, q: string, limit: number) {
    const pattern = `%${q.trim()}%`;
    const rows = await this.db
      .select()
      .from(exercises)
      .where(and(this.visibleToUser(userId), ilike(exercises.name, pattern)))
      .orderBy(exercises.name)
      .limit(limit);
    return rows.map(serializeExercise);
  }

  async findOne(userId: string, id: string) {
    const row = await this.db.query.exercises.findFirst({
      where: and(eq(exercises.id, id), this.visibleToUser(userId)),
    });
    if (!row) throw new NotFoundException('Exercise not found');
    return serializeExercise(row);
  }

  async create(
    userId: string,
    input: CreateExerciseInput,
    options: { id?: string; role?: UserRole } = {},
  ) {
    const isGlobal = input.isGlobal !== false;

    try {
      const [row] = await this.db
        .insert(exercises)
        .values({
          ...(options.id ? { id: options.id } : {}),
          userId,
          name: input.name.trim(),
          notes: input.notes ?? null,
          isGlobal,
        })
        .returning();
      return serializeExercise(row);
    } catch (error) {
      if (
        String(error).includes('exercises_user_name_active_idx') ||
        String(error).includes('exercises_global_name_active_idx')
      ) {
        throw new ConflictException('An exercise with that name already exists');
      }
      throw error;
    }
  }

  private async requireMutable(
    userId: string,
    id: string,
    role?: UserRole,
  ) {
    const existing = await this.db.query.exercises.findFirst({
      where: and(eq(exercises.id, id), isNull(exercises.deletedAt)),
    });
    if (!existing) throw new NotFoundException('Exercise not found');

    if (existing.isGlobal) {
      if (role !== 'admin') {
        throw new ForbiddenException('Only admins can modify global exercises');
      }
    } else if (existing.userId !== userId) {
      throw new ForbiddenException('Exercise not found');
    }

    return existing;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateExerciseInput,
    options: { role?: UserRole } = {},
  ) {
    await this.requireMutable(userId, id, options.role);

    if (input.isGlobal === true && options.role !== 'admin') {
      throw new ForbiddenException('Only admins can make exercises global');
    }

    try {
      const [row] = await this.db
        .update(exercises)
        .set({
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.isGlobal !== undefined && { isGlobal: input.isGlobal }),
          updatedAt: new Date(),
        })
        .where(eq(exercises.id, id))
        .returning();
      return serializeExercise(row);
    } catch (error) {
      if (
        String(error).includes('exercises_user_name_active_idx') ||
        String(error).includes('exercises_global_name_active_idx')
      ) {
        throw new ConflictException('An exercise with that name already exists');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string, options: { role?: UserRole } = {}) {
    await this.requireMutable(userId, id, options.role);

    const [row] = await this.db
      .update(exercises)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(exercises.id, id))
      .returning();
    return serializeExercise(row);
  }
}
