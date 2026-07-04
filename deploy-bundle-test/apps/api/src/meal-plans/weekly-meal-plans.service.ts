import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { weeklyMealPlanEntries, weeklyMeals, type DbClient } from '@calorie-tracker/db';
import type { WeeklyMealPlanEntryInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeWeeklyMealPlanEntry } from '../common/serializers';

@Injectable()
export class WeeklyMealPlansService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findAll(userId: string, dayOfWeek?: number) {
    let mealIds: string[] | undefined;
    if (dayOfWeek !== undefined) {
      const meals = await this.db.query.weeklyMeals.findMany({
        where: and(
          eq(weeklyMeals.userId, userId),
          eq(weeklyMeals.dayOfWeek, dayOfWeek),
          isNull(weeklyMeals.deletedAt),
        ),
        columns: { id: true },
      });
      mealIds = meals.map((meal) => meal.id);
      if (mealIds.length === 0) return [];
    }

    const rows = await this.db.query.weeklyMealPlanEntries.findMany({
      where: and(
        eq(weeklyMealPlanEntries.userId, userId),
        isNull(weeklyMealPlanEntries.deletedAt),
        mealIds ? inArray(weeklyMealPlanEntries.weeklyMealId, mealIds) : undefined,
      ),
    });
    return rows.map(serializeWeeklyMealPlanEntry);
  }

  async create(userId: string, input: WeeklyMealPlanEntryInput, id?: string) {
    const meal = await this.db.query.weeklyMeals.findFirst({
      where: and(
        eq(weeklyMeals.id, input.weeklyMealId),
        eq(weeklyMeals.userId, userId),
        isNull(weeklyMeals.deletedAt),
      ),
    });
    if (!meal) throw new NotFoundException('Weekly meal not found');

    const [row] = await this.db
      .insert(weeklyMealPlanEntries)
      .values({
        ...(id ? { id } : {}),
        userId,
        weeklyMealId: input.weeklyMealId,
        foodId: input.foodId,
        quantity: String(input.quantity),
        unit: input.unit,
      })
      .returning();
    return serializeWeeklyMealPlanEntry(row);
  }

  async update(userId: string, id: string, input: Partial<WeeklyMealPlanEntryInput>) {
    const existing = await this.db.query.weeklyMealPlanEntries.findFirst({
      where: and(
        eq(weeklyMealPlanEntries.id, id),
        eq(weeklyMealPlanEntries.userId, userId),
        isNull(weeklyMealPlanEntries.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('Weekly meal plan entry not found');

    const [row] = await this.db
      .update(weeklyMealPlanEntries)
      .set({
        ...(input.weeklyMealId !== undefined && { weeklyMealId: input.weeklyMealId }),
        ...(input.foodId !== undefined && { foodId: input.foodId }),
        ...(input.quantity !== undefined && { quantity: String(input.quantity) }),
        ...(input.unit !== undefined && { unit: input.unit }),
        updatedAt: new Date(),
      })
      .where(eq(weeklyMealPlanEntries.id, id))
      .returning();
    return serializeWeeklyMealPlanEntry(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.weeklyMealPlanEntries.findFirst({
      where: and(eq(weeklyMealPlanEntries.id, id), eq(weeklyMealPlanEntries.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Weekly meal plan entry not found');

    const [row] = await this.db
      .update(weeklyMealPlanEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyMealPlanEntries.id, id))
      .returning();
    return serializeWeeklyMealPlanEntry(row);
  }
}
