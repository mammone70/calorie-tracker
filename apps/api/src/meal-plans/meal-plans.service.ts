import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { mealPlanEntries, dayMeals, type DbClient } from '@calorie-tracker/db';
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
    const meal = await this.db.query.dayMeals.findFirst({
      where: and(
        eq(dayMeals.id, input.dayMealId),
        eq(dayMeals.userId, userId),
        isNull(dayMeals.deletedAt),
      ),
    });
    if (!meal) throw new NotFoundException('Day meal not found');

    const [row] = await this.db
      .insert(mealPlanEntries)
      .values({
        ...(id ? { id } : {}),
        userId,
        planDate: input.planDate,
        dayMealId: input.dayMealId,
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
        ...(input.dayMealId !== undefined && { dayMealId: input.dayMealId }),
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

  async removeAllForDate(userId: string, date: string) {
    const rows = await this.db.query.mealPlanEntries.findMany({
      where: and(
        eq(mealPlanEntries.userId, userId),
        eq(mealPlanEntries.planDate, date),
        isNull(mealPlanEntries.deletedAt),
      ),
    });

    const results = [];
    for (const row of rows) {
      results.push(await this.remove(userId, row.id));
    }
    return results;
  }
}
