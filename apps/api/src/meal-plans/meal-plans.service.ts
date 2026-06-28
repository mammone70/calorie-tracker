import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { mealPlanEntries, type DbClient } from '@calorie-tracker/db';
import type { MealPlanEntryInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeMealPlanEntry } from '../common/serializers';

@Injectable()
export class MealPlansService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByDate(userId: string, date: string) {
    const rows = await this.db.query.mealPlanEntries.findMany({
      where: and(
        eq(mealPlanEntries.userId, userId),
        eq(mealPlanEntries.planDate, date),
        isNull(mealPlanEntries.deletedAt),
      ),
    });
    return rows.map(serializeMealPlanEntry);
  }

  async create(userId: string, input: MealPlanEntryInput, id?: string) {
    const [row] = await this.db
      .insert(mealPlanEntries)
      .values({
        ...(id ? { id } : {}),
        userId,
        planDate: input.planDate,
        mealSlot: input.mealSlot,
        foodId: input.foodId,
        quantity: String(input.quantity),
        unit: input.unit,
      })
      .returning();
    return serializeMealPlanEntry(row);
  }

  async update(userId: string, id: string, input: Partial<MealPlanEntryInput>) {
    const existing = await this.db.query.mealPlanEntries.findFirst({
      where: and(
        eq(mealPlanEntries.id, id),
        eq(mealPlanEntries.userId, userId),
        isNull(mealPlanEntries.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Meal plan entry not found');

    const [row] = await this.db
      .update(mealPlanEntries)
      .set({
        ...(input.planDate !== undefined && { planDate: input.planDate }),
        ...(input.mealSlot !== undefined && { mealSlot: input.mealSlot }),
        ...(input.foodId !== undefined && { foodId: input.foodId }),
        ...(input.quantity !== undefined && { quantity: String(input.quantity) }),
        ...(input.unit !== undefined && { unit: input.unit }),
        updatedAt: new Date(),
      })
      .where(eq(mealPlanEntries.id, id))
      .returning();
    return serializeMealPlanEntry(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.mealPlanEntries.findFirst({
      where: and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Meal plan entry not found');

    const [row] = await this.db
      .update(mealPlanEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(mealPlanEntries.id, id))
      .returning();
    return serializeMealPlanEntry(row);
  }
}
