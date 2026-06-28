import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { weeklyMeals, type DbClient } from '@calorie-tracker/db';
import type { SetWeeklyDayMealCountInput, WeeklyMealInput } from '@calorie-tracker/shared';
import { defaultMealName } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeWeeklyMeal } from '../common/serializers';

@Injectable()
export class WeeklyMealsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findAll(userId: string, dayOfWeek?: number) {
    const rows = await this.db.query.weeklyMeals.findMany({
      where: and(
        eq(weeklyMeals.userId, userId),
        isNull(weeklyMeals.deletedAt),
        dayOfWeek !== undefined ? eq(weeklyMeals.dayOfWeek, dayOfWeek) : undefined,
      ),
    });
    return rows.map(serializeWeeklyMeal);
  }

  async create(userId: string, input: WeeklyMealInput, id?: string) {
    const [row] = await this.db
      .insert(weeklyMeals)
      .values({
        ...(id ? { id } : {}),
        userId,
        dayOfWeek: input.dayOfWeek,
        mealIndex: input.mealIndex,
        name: input.name,
        mealTime: input.mealTime ?? null,
      })
      .returning();
    return serializeWeeklyMeal(row);
  }

  async update(userId: string, id: string, input: Partial<WeeklyMealInput>) {
    const existing = await this.db.query.weeklyMeals.findFirst({
      where: and(eq(weeklyMeals.id, id), eq(weeklyMeals.userId, userId), isNull(weeklyMeals.deletedAt)),
    });
    if (!existing) throw new NotFoundException('Weekly meal not found');

    const [row] = await this.db
      .update(weeklyMeals)
      .set({
        ...(input.dayOfWeek !== undefined && { dayOfWeek: input.dayOfWeek }),
        ...(input.mealIndex !== undefined && { mealIndex: input.mealIndex }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.mealTime !== undefined && { mealTime: input.mealTime ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(weeklyMeals.id, id))
      .returning();
    return serializeWeeklyMeal(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.query.weeklyMeals.findFirst({
      where: and(eq(weeklyMeals.id, id), eq(weeklyMeals.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Weekly meal not found');

    const [row] = await this.db
      .update(weeklyMeals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyMeals.id, id))
      .returning();
    return serializeWeeklyMeal(row);
  }

  async setMealCount(userId: string, input: SetWeeklyDayMealCountInput) {
    const current = await this.findAll(userId, input.dayOfWeek);
    const { mealCount, dayOfWeek } = input;

    if (current.length < mealCount) {
      for (let index = current.length; index < mealCount; index++) {
        await this.create(userId, {
          dayOfWeek,
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

    return this.findAll(userId, dayOfWeek);
  }
}
