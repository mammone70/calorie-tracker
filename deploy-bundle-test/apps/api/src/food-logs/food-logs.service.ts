import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import {
  dailyLogMaterializations,
  dayMeals,
  foodLogEntries,
  weeklyMeals,
  type DbClient,
} from '@calorie-tracker/db';
import type { EffectiveMealPlan, FoodLogEntryInput } from '@calorie-tracker/shared';
import {
  dayOfWeekFromDate,
  loggedAtForDate,
  mealRefFromEffectiveMeal,
  resolveEffectiveMealPlan,
} from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeFoodLogEntry, toDateString } from '../common/serializers';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { WeeklyMealPlansService } from '../meal-plans/weekly-meal-plans.service';
import { WeeklyMealsService } from '../meal-plans/weekly-meals.service';
import { DayMealsService } from '../meal-plans/day-meals.service';

@Injectable()
export class FoodLogsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly mealPlansService: MealPlansService,
    private readonly weeklyMealPlansService: WeeklyMealPlansService,
    private readonly weeklyMealsService: WeeklyMealsService,
    private readonly dayMealsService: DayMealsService,
  ) {}

  private utcDayBounds(date: string) {
    return {
      start: new Date(`${date}T00:00:00.000Z`),
      end: new Date(`${date}T23:59:59.999Z`),
    };
  }

  async findByDate(userId: string, date: string) {
    const { start, end } = this.utcDayBounds(date);
    const dayOfWeek = dayOfWeekFromDate(date);

    const [weeklyMealsList, dayMealsList] = await Promise.all([
      this.weeklyMealsService.findAll(userId, dayOfWeek),
      this.dayMealsService.findByDate(userId, date),
    ]);

    const weeklyMealIds = weeklyMealsList.map((meal) => meal.id);
    const dayMealIds = dayMealsList.map((meal) => meal.id);

    const dateRange = and(
      gte(foodLogEntries.loggedAt, start),
      lt(foodLogEntries.loggedAt, new Date(end.getTime() + 1)),
    );

    const scopeConditions = [dateRange];
    if (weeklyMealIds.length > 0) {
      scopeConditions.push(inArray(foodLogEntries.weeklyMealId, weeklyMealIds));
    }
    if (dayMealIds.length > 0) {
      scopeConditions.push(inArray(foodLogEntries.dayMealId, dayMealIds));
    }

    const rows = await this.db.query.foodLogEntries.findMany({
      where: and(
        eq(foodLogEntries.userId, userId),
        isNull(foodLogEntries.deletedAt),
        or(...scopeConditions),
      ),
    });
    return rows.map(serializeFoodLogEntry);
  }

  private async validateMealRef(userId: string, input: FoodLogEntryInput) {
    const logDate = toDateString(input.loggedAt);

    if (input.dayMealId) {
      const meal = await this.db.query.dayMeals.findFirst({
        where: and(
          eq(dayMeals.id, input.dayMealId),
          eq(dayMeals.userId, userId),
          isNull(dayMeals.deletedAt),
        ),
      });
      if (!meal) throw new NotFoundException('Day meal not found');
      if (toDateString(meal.planDate) !== logDate) {
        throw new BadRequestException('Day meal does not match log date');
      }
      return;
    }

    if (input.weeklyMealId) {
      const meal = await this.db.query.weeklyMeals.findFirst({
        where: and(
          eq(weeklyMeals.id, input.weeklyMealId),
          eq(weeklyMeals.userId, userId),
          isNull(weeklyMeals.deletedAt),
        ),
      });
      if (!meal) throw new NotFoundException('Weekly meal not found');
      if (meal.dayOfWeek !== dayOfWeekFromDate(logDate)) {
        throw new BadRequestException('Weekly meal does not match log date');
      }
    }
  }

  async create(userId: string, input: FoodLogEntryInput, id?: string) {
    await this.validateMealRef(userId, input);

    const [row] = await this.db
      .insert(foodLogEntries)
      .values({
        ...(id ? { id } : {}),
        userId,
        loggedAt: new Date(input.loggedAt),
        weeklyMealId: input.weeklyMealId ?? null,
        dayMealId: input.dayMealId ?? null,
        foodId: input.foodId,
        quantity: String(input.quantity),
        unit: input.unit,
        status: input.status ?? 'confirmed',
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

    const merged: FoodLogEntryInput = {
      loggedAt: input.loggedAt ?? existing.loggedAt.toISOString(),
      weeklyMealId: input.weeklyMealId ?? existing.weeklyMealId ?? undefined,
      dayMealId: input.dayMealId ?? existing.dayMealId ?? undefined,
      foodId: input.foodId ?? existing.foodId,
      quantity: input.quantity !== undefined ? input.quantity : Number(existing.quantity),
      unit: input.unit ?? existing.unit,
      status: input.status ?? existing.status,
    };

    await this.validateMealRef(userId, merged);

    const [row] = await this.db
      .update(foodLogEntries)
      .set({
        ...(input.loggedAt !== undefined && { loggedAt: new Date(input.loggedAt) }),
        ...(input.weeklyMealId !== undefined && { weeklyMealId: input.weeklyMealId ?? null }),
        ...(input.dayMealId !== undefined && { dayMealId: input.dayMealId ?? null }),
        ...(input.foodId !== undefined && { foodId: input.foodId }),
        ...(input.quantity !== undefined && { quantity: String(input.quantity) }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(eq(foodLogEntries.id, id))
      .returning();
    return serializeFoodLogEntry(row);
  }

  async confirm(userId: string, id: string) {
    return this.update(userId, id, { status: 'confirmed' });
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

  private logKey(
    log: { weeklyMealId?: string | null; dayMealId?: string | null; foodId: string },
    weeklyMealId?: string,
    dayMealId?: string,
  ) {
    return `${weeklyMealId ?? log.weeklyMealId ?? ''}:${dayMealId ?? log.dayMealId ?? ''}:${log.foodId}`;
  }

  private async getEffectivePlanForDate(userId: string, date: string) {
    const dayOfWeek = dayOfWeekFromDate(date);
    const [dayMealsList, datePlanEntries, weeklyMealsList, weeklyPlanEntries] = await Promise.all([
      this.dayMealsService.findByDate(userId, date),
      this.mealPlansService.findByDate(userId, date),
      this.weeklyMealsService.findAll(userId, dayOfWeek),
      this.weeklyMealPlansService.findAll(userId, dayOfWeek),
    ]);

    return resolveEffectiveMealPlan(
      date,
      dayMealsList,
      datePlanEntries,
      weeklyMealsList,
      weeklyPlanEntries,
    );
  }

  private async syncMissingFromPlan(
    userId: string,
    date: string,
    effectivePlan: EffectiveMealPlan,
    existingLogs: Awaited<ReturnType<typeof this.findByDate>>,
  ) {
    const existingKeys = new Set(
      existingLogs.map((log) => this.logKey(log)),
    );

    const created = [];
    for (const meal of effectivePlan.meals) {
      const mealRef = mealRefFromEffectiveMeal(meal);
      for (const entry of meal.entries) {
        const key = this.logKey(
          { foodId: entry.foodId, ...mealRef },
          mealRef.weeklyMealId,
          mealRef.dayMealId,
        );
        if (existingKeys.has(key)) continue;

        created.push(
          await this.create(userId, {
            loggedAt: loggedAtForDate(date, meal.mealTime),
            ...mealRef,
            foodId: entry.foodId,
            quantity: entry.quantity,
            unit: entry.unit,
            status: 'pending',
          }),
        );
        existingKeys.add(key);
      }
    }

    return created;
  }

  async materializeFromPlan(userId: string, date: string) {
    const effectivePlan = await this.getEffectivePlanForDate(userId, date);
    let existingLogs = await this.findByDate(userId, date);

    await this.syncMissingFromPlan(userId, date, effectivePlan, existingLogs);

    const existingMaterialization = await this.db.query.dailyLogMaterializations.findFirst({
      where: and(
        eq(dailyLogMaterializations.userId, userId),
        eq(dailyLogMaterializations.planDate, date),
      ),
    });

    if (!existingMaterialization && (effectivePlan.meals.length > 0 || existingLogs.length > 0)) {
      await this.db.insert(dailyLogMaterializations).values({
        userId,
        planDate: date,
      });
    }

    return this.findByDate(userId, date);
  }
}
