import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { weeklyMacroTargets, type DbClient } from '@calorie-tracker/db';
import type { WeeklyMacroTargetInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeWeeklyMacroTarget } from '../common/serializers';

@Injectable()
export class WeeklyMacroTargetsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findAll(userId: string) {
    const rows = await this.db.query.weeklyMacroTargets.findMany({
      where: and(eq(weeklyMacroTargets.userId, userId), isNull(weeklyMacroTargets.deletedAt)),
    });
    return rows.map(serializeWeeklyMacroTarget);
  }

  async upsert(userId: string, input: WeeklyMacroTargetInput, id?: string) {
    const existing = await this.db.query.weeklyMacroTargets.findFirst({
      where: id
        ? and(eq(weeklyMacroTargets.id, id), eq(weeklyMacroTargets.userId, userId))
        : and(
            eq(weeklyMacroTargets.userId, userId),
            eq(weeklyMacroTargets.dayOfWeek, input.dayOfWeek),
          ),
    });

    if (existing) {
      const [row] = await this.db
        .update(weeklyMacroTargets)
        .set({
          calories: input.calories,
          proteinG: String(input.proteinG),
          fatG: String(input.fatG),
          carbsG: String(input.carbsG),
          updatedAt: new Date(),
          deletedAt: null,
        })
        .where(eq(weeklyMacroTargets.id, existing.id))
        .returning();
      return serializeWeeklyMacroTarget(row);
    }

    const [row] = await this.db
      .insert(weeklyMacroTargets)
      .values({
        ...(id ? { id } : {}),
        userId,
        dayOfWeek: input.dayOfWeek,
        calories: input.calories,
        proteinG: String(input.proteinG),
        fatG: String(input.fatG),
        carbsG: String(input.carbsG),
      })
      .returning();
    return serializeWeeklyMacroTarget(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.weeklyMacroTargets.findFirst({
      where: and(eq(weeklyMacroTargets.id, id), eq(weeklyMacroTargets.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Weekly macro target not found');

    const [row] = await this.db
      .update(weeklyMacroTargets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyMacroTargets.id, id))
      .returning();
    return serializeWeeklyMacroTarget(row);
  }
}
