import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lte, isNull } from 'drizzle-orm';
import { macroTargets, type DbClient } from '@calorie-tracker/db';
import type { MacroTargetInput } from '@calorie-tracker/shared';
import { resolveEffectiveTargetsInRange } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeMacroTarget } from '../common/serializers';
import { WeeklyMacroTargetsService } from './weekly-macro-targets.service';

@Injectable()
export class MacroTargetsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly weeklyService: WeeklyMacroTargetsService,
  ) {}

  async findByRange(userId: string, from: string, to: string) {
    const rows = await this.db.query.macroTargets.findMany({
      where: and(
        eq(macroTargets.userId, userId),
        gte(macroTargets.targetDate, from),
        lte(macroTargets.targetDate, to),
        isNull(macroTargets.deletedAt),
      ),
    });
    return rows.map(serializeMacroTarget);
  }

  async findEffectiveByRange(userId: string, from: string, to: string) {
    const [overrides, weekly] = await Promise.all([
      this.findByRange(userId, from, to),
      this.weeklyService.findAll(userId),
    ]);
    return resolveEffectiveTargetsInRange(from, to, overrides, weekly);
  }

  async upsert(userId: string, input: MacroTargetInput, id?: string) {
    const existing = await this.db.query.macroTargets.findFirst({
      where: id
        ? and(eq(macroTargets.id, id), eq(macroTargets.userId, userId))
        : and(
            eq(macroTargets.userId, userId),
            eq(macroTargets.targetDate, input.targetDate),
          ),
    });

    if (existing) {
      const [row] = await this.db
        .update(macroTargets)
        .set({
          calories: input.calories,
          proteinG: String(input.proteinG),
          fatG: String(input.fatG),
          carbsG: String(input.carbsG),
          updatedAt: new Date(),
          deletedAt: null,
        })
        .where(eq(macroTargets.id, existing.id))
        .returning();
      return serializeMacroTarget(row);
    }

    const [row] = await this.db
      .insert(macroTargets)
      .values({
        ...(id ? { id } : {}),
        userId,
        targetDate: input.targetDate,
        calories: input.calories,
        proteinG: String(input.proteinG),
        fatG: String(input.fatG),
        carbsG: String(input.carbsG),
      })
      .returning();
    return serializeMacroTarget(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.macroTargets.findFirst({
      where: and(eq(macroTargets.id, id), eq(macroTargets.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Macro target not found');

    const [row] = await this.db
      .update(macroTargets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(macroTargets.id, id))
      .returning();
    return serializeMacroTarget(row);
  }
}
