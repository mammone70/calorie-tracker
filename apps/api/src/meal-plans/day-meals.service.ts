import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { dayMeals, type DbClient } from '@calorie-tracker/db';
import type { DayMealInput, SetDayMealCountInput } from '@calorie-tracker/shared';
import { defaultMealName } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeDayMeal } from '../common/serializers';

@Injectable()
export class DayMealsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByDate(userId: string, planDate: string) {
    const rows = await this.db.query.dayMeals.findMany({
      where: and(
        eq(dayMeals.userId, userId),
        eq(dayMeals.planDate, planDate),
        isNull(dayMeals.deletedAt),
      ),
    });
    return rows.map(serializeDayMeal);
  }

  async create(userId: string, input: DayMealInput, id?: string) {
    const [row] = await this.db
      .insert(dayMeals)
      .values({
        ...(id ? { id } : {}),
        userId,
        planDate: input.planDate,
        mealIndex: input.mealIndex,
        name: input.name,
        mealTime: input.mealTime ?? null,
      })
      .returning();
    return serializeDayMeal(row);
  }

  async update(userId: string, id: string, input: Partial<DayMealInput>) {
    const existing = await this.db.query.dayMeals.findFirst({
      where: and(eq(dayMeals.id, id), eq(dayMeals.userId, userId), isNull(dayMeals.deletedAt)),
    });
    if (!existing) throw new NotFoundException('Day meal not found');

    const [row] = await this.db
      .update(dayMeals)
      .set({
        ...(input.planDate !== undefined && { planDate: input.planDate }),
        ...(input.mealIndex !== undefined && { mealIndex: input.mealIndex }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.mealTime !== undefined && { mealTime: input.mealTime ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(dayMeals.id, id))
      .returning();
    return serializeDayMeal(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.dayMeals.findFirst({
      where: and(eq(dayMeals.id, id), eq(dayMeals.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Day meal not found');

    const [row] = await this.db
      .update(dayMeals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dayMeals.id, id))
      .returning();
    return serializeDayMeal(row);
  }

  async removeAllForDate(userId: string, planDate: string) {
    const rows = await this.findByDate(userId, planDate);
    const results = [];
    for (const row of rows) {
      results.push(await this.remove(userId, row.id));
    }
    return results;
  }

  async setMealCount(userId: string, input: SetDayMealCountInput) {
    const current = await this.findByDate(userId, input.planDate);
    const { mealCount, planDate } = input;

    if (current.length < mealCount) {
      for (let index = current.length; index < mealCount; index++) {
        await this.create(userId, {
          planDate,
          mealIndex: index,
          name: defaultMealName(index),
        });
      }
    } else if (current.length > mealCount) {
      const toRemove = current
        .filter((meal) => meal.mealIndex >= mealCount)
        .sort((a, b) => b.mealIndex - a.mealIndex);
      for (const meal of toRemove) {
        await this.remove(userId, meal.id);
      }
    }

    return this.findByDate(userId, planDate);
  }
}
