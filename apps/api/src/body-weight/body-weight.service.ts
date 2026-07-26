import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { bodyWeightLogs, type DbClient } from '@calorie-tracker/db';
import {
  DEFAULT_WEIGHT_UNIT,
  type UpsertBodyWeightLogInput,
  type WeightUnit,
} from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { toDateString, toIso } from '../common/serializers';

function serializeBodyWeightLog(row: typeof bodyWeightLogs.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    loggedOn: toDateString(row.loggedOn),
    weight: Number(row.weight),
    unit: row.unit as WeightUnit,
    notes: row.notes ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

@Injectable()
export class BodyWeightService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByDate(userId: string, date: string) {
    const row = await this.db.query.bodyWeightLogs.findFirst({
      where: and(
        eq(bodyWeightLogs.userId, userId),
        eq(bodyWeightLogs.loggedOn, date),
        isNull(bodyWeightLogs.deletedAt),
      ),
    });
    return row ? serializeBodyWeightLog(row) : null;
  }

  async findRange(userId: string, from: string, to: string) {
    if (from > to) {
      throw new BadRequestException('from must be on or before to');
    }
    const rows = await this.db.query.bodyWeightLogs.findMany({
      where: and(
        eq(bodyWeightLogs.userId, userId),
        gte(bodyWeightLogs.loggedOn, from),
        lte(bodyWeightLogs.loggedOn, to),
        isNull(bodyWeightLogs.deletedAt),
      ),
      orderBy: [asc(bodyWeightLogs.loggedOn)],
    });
    return rows.map(serializeBodyWeightLog);
  }

  async upsert(userId: string, input: UpsertBodyWeightLogInput) {
    const unit = input.unit ?? DEFAULT_WEIGHT_UNIT;
    const existing = await this.db.query.bodyWeightLogs.findFirst({
      where: and(
        eq(bodyWeightLogs.userId, userId),
        eq(bodyWeightLogs.loggedOn, input.loggedOn),
        isNull(bodyWeightLogs.deletedAt),
      ),
    });

    if (existing) {
      const [row] = await this.db
        .update(bodyWeightLogs)
        .set({
          weight: String(input.weight),
          unit,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(bodyWeightLogs.id, existing.id))
        .returning();
      return serializeBodyWeightLog(row);
    }

    const [row] = await this.db
      .insert(bodyWeightLogs)
      .values({
        userId,
        loggedOn: input.loggedOn,
        weight: String(input.weight),
        unit,
        notes: input.notes ?? null,
      })
      .returning();
    return serializeBodyWeightLog(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.bodyWeightLogs.findFirst({
      where: and(
        eq(bodyWeightLogs.id, id),
        eq(bodyWeightLogs.userId, userId),
        isNull(bodyWeightLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Body weight log not found');

    await this.db
      .update(bodyWeightLogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(bodyWeightLogs.id, id));

    return { ok: true };
  }
}
