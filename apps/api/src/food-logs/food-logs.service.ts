import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lt, isNull } from 'drizzle-orm';
import { foodLogEntries, type DbClient } from '@calorie-tracker/db';
import type { FoodLogEntryInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeFoodLogEntry } from '../common/serializers';

@Injectable()
export class FoodLogsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByDate(userId: string, date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const rows = await this.db.query.foodLogEntries.findMany({
      where: and(
        eq(foodLogEntries.userId, userId),
        gte(foodLogEntries.loggedAt, start),
        lt(foodLogEntries.loggedAt, new Date(end.getTime() + 1)),
        isNull(foodLogEntries.deletedAt),
      ),
    });
    return rows.map(serializeFoodLogEntry);
  }

  async create(userId: string, input: FoodLogEntryInput, id?: string) {
    const [row] = await this.db
      .insert(foodLogEntries)
      .values({
        ...(id ? { id } : {}),
        userId,
        loggedAt: new Date(input.loggedAt),
        mealSlot: input.mealSlot,
        foodId: input.foodId,
        quantity: String(input.quantity),
        unit: input.unit,
      })
      .returning();
    return serializeFoodLogEntry(row);
  }

  async update(userId: string, id: string, input: Partial<FoodLogEntryInput>) {
    const existing = await this.db.query.foodLogEntries.findFirst({
      where: and(
        eq(foodLogEntries.id, id),
        eq(foodLogEntries.userId, userId),
        isNull(foodLogEntries.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Food log entry not found');

    const [row] = await this.db
      .update(foodLogEntries)
      .set({
        ...(input.loggedAt !== undefined && { loggedAt: new Date(input.loggedAt) }),
        ...(input.mealSlot !== undefined && { mealSlot: input.mealSlot }),
        ...(input.foodId !== undefined && { foodId: input.foodId }),
        ...(input.quantity !== undefined && { quantity: String(input.quantity) }),
        ...(input.unit !== undefined && { unit: input.unit }),
        updatedAt: new Date(),
      })
      .where(eq(foodLogEntries.id, id))
      .returning();
    return serializeFoodLogEntry(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.foodLogEntries.findFirst({
      where: and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Food log entry not found');

    const [row] = await this.db
      .update(foodLogEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(foodLogEntries.id, id))
      .returning();
    return serializeFoodLogEntry(row);
  }
}
