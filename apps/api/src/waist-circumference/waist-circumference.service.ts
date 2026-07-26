import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { waistCircumferenceLogs, type DbClient } from '@calorie-tracker/db';
import type { UpsertWaistCircumferenceLogInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { toDateString, toIso } from '../common/serializers';

function serializeWaistLog(row: typeof waistCircumferenceLogs.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    loggedOn: toDateString(row.loggedOn),
    inches: Number(row.inches),
    notes: row.notes ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    deletedAt: toIso(row.deletedAt),
  };
}

@Injectable()
export class WaistCircumferenceService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByDate(userId: string, date: string) {
    const row = await this.db.query.waistCircumferenceLogs.findFirst({
      where: and(
        eq(waistCircumferenceLogs.userId, userId),
        eq(waistCircumferenceLogs.loggedOn, date),
        isNull(waistCircumferenceLogs.deletedAt),
      ),
    });
    return row ? serializeWaistLog(row) : null;
  }

  async findLatest(userId: string, onOrBefore?: string) {
    const row = await this.db.query.waistCircumferenceLogs.findFirst({
      where: and(
        eq(waistCircumferenceLogs.userId, userId),
        isNull(waistCircumferenceLogs.deletedAt),
        ...(onOrBefore ? [lte(waistCircumferenceLogs.loggedOn, onOrBefore)] : []),
      ),
      orderBy: [desc(waistCircumferenceLogs.loggedOn)],
    });
    return row ? serializeWaistLog(row) : null;
  }

  async findRange(userId: string, from: string, to: string) {
    if (from > to) {
      throw new BadRequestException('from must be on or before to');
    }
    const rows = await this.db.query.waistCircumferenceLogs.findMany({
      where: and(
        eq(waistCircumferenceLogs.userId, userId),
        gte(waistCircumferenceLogs.loggedOn, from),
        lte(waistCircumferenceLogs.loggedOn, to),
        isNull(waistCircumferenceLogs.deletedAt),
      ),
      orderBy: [asc(waistCircumferenceLogs.loggedOn)],
    });
    return rows.map(serializeWaistLog);
  }

  async upsert(userId: string, input: UpsertWaistCircumferenceLogInput) {
    const existing = await this.db.query.waistCircumferenceLogs.findFirst({
      where: and(
        eq(waistCircumferenceLogs.userId, userId),
        eq(waistCircumferenceLogs.loggedOn, input.loggedOn),
        isNull(waistCircumferenceLogs.deletedAt),
      ),
    });

    if (existing) {
      const [row] = await this.db
        .update(waistCircumferenceLogs)
        .set({
          inches: String(input.inches),
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(waistCircumferenceLogs.id, existing.id))
        .returning();
      return serializeWaistLog(row);
    }

    const [row] = await this.db
      .insert(waistCircumferenceLogs)
      .values({
        userId,
        loggedOn: input.loggedOn,
        inches: String(input.inches),
        notes: input.notes ?? null,
      })
      .returning();
    return serializeWaistLog(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.waistCircumferenceLogs.findFirst({
      where: and(
        eq(waistCircumferenceLogs.id, id),
        eq(waistCircumferenceLogs.userId, userId),
        isNull(waistCircumferenceLogs.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Waist circumference log not found');

    await this.db
      .update(waistCircumferenceLogs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(waistCircumferenceLogs.id, id));

    return { ok: true };
  }
}
