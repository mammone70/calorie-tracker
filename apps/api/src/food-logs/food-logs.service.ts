import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import {
  dailyLogMaterializations,
  dayMeals,
  foodLogEntries,
  weeklyMealPlanEntries,
  weeklyMeals,
  type DbClient,
} from '@calorie-tracker/db';
import type { EffectiveMealPlan, FoodLogEntryInput } from '@calorie-tracker/shared';
import {
  dayOfWeekFromDate,
  formatDateInTimeZone,
  localDayBoundsUtc,
  loggedAtForDate,
  mealRefFromEffectiveMeal,
  resolveEffectiveMealPlan,
  todayDateString,
  upcomingDatesForWeekday,
} from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import { serializeFoodLogEntry, toDateString } from '../common/serializers';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { WeeklyMealPlansService } from '../meal-plans/weekly-meal-plans.service';
import { WeeklyMealsService } from '../meal-plans/weekly-meals.service';
import { DayMealsService } from '../meal-plans/day-meals.service';

type SerializedFoodLog = ReturnType<typeof serializeFoodLogEntry>;

@Injectable()
export class FoodLogsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly mealPlansService: MealPlansService,
    private readonly weeklyMealPlansService: WeeklyMealPlansService,
    private readonly weeklyMealsService: WeeklyMealsService,
    private readonly dayMealsService: DayMealsService,
  ) {}

  private dayBounds(date: string, timeZone: string) {
    const { start, end } = localDayBoundsUtc(date, timeZone);
    return {
      start,
      endExclusive: new Date(end.getTime() + 1),
    };
  }

  async findByDate(userId: string, date: string, timeZone: string) {
    const { start, endExclusive } = this.dayBounds(date, timeZone);

    const rows = await this.db.query.foodLogEntries.findMany({
      where: and(
        eq(foodLogEntries.userId, userId),
        isNull(foodLogEntries.deletedAt),
        gte(foodLogEntries.loggedAt, start),
        lt(foodLogEntries.loggedAt, endExclusive),
      ),
    });
    return rows.map(serializeFoodLogEntry);
  }

  private async validateMealRef(userId: string, input: FoodLogEntryInput, timeZone: string) {
    const logDate = formatDateInTimeZone(new Date(input.loggedAt), timeZone);

    if (input.dayMealId) {
      const meal = await this.db.query.dayMeals.findFirst({
        where: and(
          eq(dayMeals.id, input.dayMealId),
          eq(dayMeals.userId, userId),
          isNull(dayMeals.deletedAt),
        ),
      });
      if (!meal) throw new NotFoundException('Day meal not found');
      // planDate is a calendar date — compare as YYYY-MM-DD, not via timezone conversion
      // (new Date('YYYY-MM-DD') is UTC midnight and shifts back a day in US timezones).
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

  async create(userId: string, input: FoodLogEntryInput, id?: string, timeZone?: string) {
    const tz = timeZone ?? 'America/Los_Angeles';
    await this.validateMealRef(userId, input, tz);

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

  async update(
    userId: string,
    id: string,
    input: Partial<FoodLogEntryInput>,
    timeZone?: string,
    options?: { syncPlan?: boolean },
  ) {
    const tz = timeZone ?? 'America/Los_Angeles';
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

    await this.validateMealRef(userId, merged, tz);

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

    const shouldSyncPlan =
      options?.syncPlan !== false &&
      (input.quantity !== undefined || input.unit !== undefined);

    if (shouldSyncPlan) {
      await this.syncDayPlanFromLog(
        userId,
        serializeFoodLogEntry(row),
        Number(row.quantity),
        row.unit,
        tz,
      );
      const refreshed = await this.db.query.foodLogEntries.findFirst({
        where: and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)),
      });
      if (refreshed) return serializeFoodLogEntry(refreshed);
    }

    return serializeFoodLogEntry(row);
  }

  /** Fork weekly → day override if needed, then write quantity/unit onto the day's plan entry. */
  private async ensureDayOverride(userId: string, date: string, timeZone: string) {
    const existingEntries = await this.mealPlansService.findByDate(userId, date);
    const existingMeals = await this.dayMealsService.findByDate(userId, date);
    const dayOfWeek = dayOfWeekFromDate(date);

    if (existingEntries.length > 0 || existingMeals.length > 0) {
      const weeklyMeals = await this.weeklyMealsService.findAll(userId, dayOfWeek);
      const mealIdMap = new Map<string, string>();
      for (const weekly of weeklyMeals) {
        const dayMeal = existingMeals.find((meal) => meal.mealIndex === weekly.mealIndex);
        if (dayMeal) mealIdMap.set(weekly.id, dayMeal.id);
      }
      await this.remapWeeklyLogsToDayMeals(userId, date, mealIdMap, timeZone);
      return;
    }

    const [weeklyMeals, weeklyEntries] = await Promise.all([
      this.weeklyMealsService.findAll(userId, dayOfWeek),
      this.weeklyMealPlansService.findAll(userId, dayOfWeek),
    ]);

    const mealIdMap = new Map<string, string>();
    for (const meal of weeklyMeals) {
      const created = await this.dayMealsService.create(userId, {
        planDate: date,
        mealIndex: meal.mealIndex,
        name: meal.name,
        mealTime: meal.mealTime ?? undefined,
      });
      mealIdMap.set(meal.id, created.id);
    }

    for (const entry of weeklyEntries) {
      const dayMealId = mealIdMap.get(entry.weeklyMealId);
      if (!dayMealId) continue;
      await this.mealPlansService.create(userId, {
        planDate: date,
        dayMealId,
        foodId: entry.foodId,
        quantity: entry.quantity,
        unit: entry.unit,
      });
    }

    await this.remapWeeklyLogsToDayMeals(userId, date, mealIdMap, timeZone);
  }

  private async syncDayPlanFromLog(
    userId: string,
    log: SerializedFoodLog,
    quantity: number,
    unit: string,
    timeZone: string,
  ) {
    const date = formatDateInTimeZone(new Date(log.loggedAt), timeZone);

    // Day plans own quantities; fork off the weekly template before writing.
    if (log.weeklyMealId || !(await this.hasDayOverride(userId, date))) {
      await this.ensureDayOverride(userId, date, timeZone);
    }

    const refreshed = await this.db.query.foodLogEntries.findFirst({
      where: and(
        eq(foodLogEntries.id, log.id),
        eq(foodLogEntries.userId, userId),
        isNull(foodLogEntries.deletedAt),
      ),
    });
    if (!refreshed?.dayMealId) return;

    const entries = await this.mealPlansService.findByDate(userId, date);
    const match = entries.find(
      (entry) => entry.dayMealId === refreshed.dayMealId && entry.foodId === refreshed.foodId,
    );

    if (match) {
      if (match.quantity !== quantity || match.unit !== unit) {
        await this.mealPlansService.update(userId, match.id, { quantity, unit });
      }
      return;
    }

    await this.mealPlansService.create(userId, {
      planDate: date,
      dayMealId: refreshed.dayMealId,
      foodId: refreshed.foodId,
      quantity,
      unit,
    });
  }

  async confirm(userId: string, id: string, timeZone?: string) {
    return this.update(userId, id, { status: 'confirmed' }, timeZone);
  }

  async remove(
    userId: string,
    id: string,
    timeZone?: string,
    options?: { syncPlan?: boolean },
  ) {
    const tz = timeZone ?? 'America/Los_Angeles';
    const existing = await this.db.query.foodLogEntries.findFirst({
      where: and(eq(foodLogEntries.id, id), eq(foodLogEntries.userId, userId)),
    });
    if (!existing) throw new NotFoundException('Food log entry not found');

    if (options?.syncPlan === true && !existing.deletedAt) {
      await this.removeDayPlanEntryForLog(userId, serializeFoodLogEntry(existing), tz);
    }

    const [row] = await this.db
      .update(foodLogEntries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(foodLogEntries.id, id))
      .returning();
    return serializeFoodLogEntry(row);
  }

  private async removeDayPlanEntryForLog(
    userId: string,
    log: SerializedFoodLog,
    timeZone: string,
  ) {
    const date = formatDateInTimeZone(new Date(log.loggedAt), timeZone);

    if (log.weeklyMealId || !(await this.hasDayOverride(userId, date))) {
      await this.ensureDayOverride(userId, date, timeZone);
    }

    let dayMealId = log.dayMealId ?? null;
    if (!dayMealId && log.weeklyMealId) {
      const refreshed = await this.db.query.foodLogEntries.findFirst({
        where: and(
          eq(foodLogEntries.id, log.id),
          eq(foodLogEntries.userId, userId),
          isNull(foodLogEntries.deletedAt),
        ),
      });
      dayMealId = refreshed?.dayMealId ?? null;
    }

    // After forking, weekly-linked logs are remapped; resolve day meal via meal index if needed.
    if (!dayMealId && log.weeklyMealId) {
      const weekly = await this.db.query.weeklyMeals.findFirst({
        where: and(
          eq(weeklyMeals.id, log.weeklyMealId),
          eq(weeklyMeals.userId, userId),
          isNull(weeklyMeals.deletedAt),
        ),
      });
      if (weekly) {
        const dayMealList = await this.dayMealsService.findByDate(userId, date);
        dayMealId = dayMealList.find((meal) => meal.mealIndex === weekly.mealIndex)?.id ?? null;
      }
    }

    if (!dayMealId) return;

    const entries = await this.mealPlansService.findByDate(userId, date);
    const match = entries.find(
      (entry) => entry.dayMealId === dayMealId && entry.foodId === log.foodId,
    );
    if (match) {
      await this.mealPlansService.remove(userId, match.id);
    }
  }

  async remapWeeklyLogsToDayMeals(
    userId: string,
    date: string,
    weeklyToDayMealId: Map<string, string>,
    timeZone: string,
  ) {
    if (weeklyToDayMealId.size === 0) return;

    const logs = await this.findByDate(userId, date, timeZone);
    for (const log of logs) {
      if (!log.weeklyMealId) continue;
      const dayMealId = weeklyToDayMealId.get(log.weeklyMealId);
      if (!dayMealId) continue;

      await this.db
        .update(foodLogEntries)
        .set({
          weeklyMealId: null,
          dayMealId,
          updatedAt: new Date(),
        })
        .where(eq(foodLogEntries.id, log.id));
    }
  }

  async removeLogsForDayMeal(userId: string, dayMealId: string) {
    const rows = await this.db.query.foodLogEntries.findMany({
      where: and(
        eq(foodLogEntries.userId, userId),
        eq(foodLogEntries.dayMealId, dayMealId),
        isNull(foodLogEntries.deletedAt),
      ),
    });
    for (const row of rows) {
      await this.remove(userId, row.id);
    }
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

  private async hasDayOverride(userId: string, date: string) {
    const [dayMealsList, datePlanEntries] = await Promise.all([
      this.dayMealsService.findByDate(userId, date),
      this.mealPlansService.findByDate(userId, date),
    ]);
    return dayMealsList.length > 0 || datePlanEntries.length > 0;
  }

  private async syncMissingFromPlan(
    userId: string,
    date: string,
    effectivePlan: EffectiveMealPlan,
    existingLogs: SerializedFoodLog[],
    timeZone: string,
  ) {
    const existingKeys = new Set(existingLogs.map((log) => this.logKey(log)));

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
          await this.create(
            userId,
            {
              loggedAt: loggedAtForDate(date, meal.mealTime, timeZone),
              ...mealRef,
              foodId: entry.foodId,
              quantity: entry.quantity,
              unit: entry.unit,
              status: 'pending',
            },
            undefined,
            timeZone,
          ),
        );
        existingKeys.add(key);
      }
    }

    return created;
  }

  private async syncPendingLogsFromPlan(
    userId: string,
    date: string,
    effectivePlan: EffectiveMealPlan,
    existingLogs: SerializedFoodLog[],
    timeZone: string,
  ) {
    const planEntries = effectivePlan.meals.flatMap((meal) => {
      const mealRef = mealRefFromEffectiveMeal(meal);
      return meal.entries.map((entry) => ({
        key: this.logKey(
          { foodId: entry.foodId, ...mealRef },
          mealRef.weeklyMealId,
          mealRef.dayMealId,
        ),
        entry,
      }));
    });
    const planByKey = new Map(planEntries.map((row) => [row.key, row.entry]));

    for (const log of existingLogs) {
      if (log.status !== 'pending') continue;

      const key = this.logKey(log);
      const planEntry = planByKey.get(key);
      // Only sync quantities for pending plan foods. Do not soft-delete unmatched
      // pending logs — manually added foods that were unconfirmed must remain.
      if (!planEntry) continue;

      if (log.quantity !== planEntry.quantity) {
        await this.update(userId, log.id, { quantity: planEntry.quantity }, timeZone, {
          syncPlan: false,
        });
      }
    }

    const refreshedLogs = await this.findByDate(userId, date, timeZone);
    await this.syncMissingFromPlan(userId, date, effectivePlan, refreshedLogs, timeZone);
    return this.findByDate(userId, date, timeZone);
  }

  async removePendingLogsForWeeklyPlanFood(
    userId: string,
    weeklyMealId: string,
    foodId: string,
    timeZone: string,
  ) {
    const meal = await this.db.query.weeklyMeals.findFirst({
      where: and(
        eq(weeklyMeals.id, weeklyMealId),
        eq(weeklyMeals.userId, userId),
      ),
      columns: { dayOfWeek: true },
    });
    if (!meal) return;

    const today = todayDateString(timeZone);
    const dates = upcomingDatesForWeekday(meal.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6, today);

    for (const date of dates) {
      if (await this.hasDayOverride(userId, date)) continue;
      const logs = await this.findByDate(userId, date, timeZone);
      for (const log of logs) {
        if (
          log.status === 'pending' &&
          log.weeklyMealId === weeklyMealId &&
          log.foodId === foodId
        ) {
          await this.remove(userId, log.id);
        }
      }
    }
  }

  async materializeFromPlan(userId: string, date: string, timeZone: string) {
    const effectivePlan = await this.getEffectivePlanForDate(userId, date);
    const existingLogs = await this.findByDate(userId, date, timeZone);
    const today = todayDateString(timeZone);

    if (effectivePlan.source === 'override') {
      const dayOfWeek = dayOfWeekFromDate(date);
      const weeklyMealsList = await this.weeklyMealsService.findAll(userId, dayOfWeek);
      const mealIdMap = new Map<string, string>();
      for (const weekly of weeklyMealsList) {
        const dayMeal = effectivePlan.meals.find((meal) => meal.mealIndex === weekly.mealIndex);
        if (dayMeal) mealIdMap.set(weekly.id, dayMeal.id);
      }
      await this.remapWeeklyLogsToDayMeals(userId, date, mealIdMap, timeZone);
      const refreshed = await this.findByDate(userId, date, timeZone);
      await this.syncMissingFromPlan(userId, date, effectivePlan, refreshed, timeZone);
    } else if (date < today) {
      await this.syncMissingFromPlan(userId, date, effectivePlan, existingLogs, timeZone);
    } else {
      await this.syncPendingLogsFromPlan(userId, date, effectivePlan, existingLogs, timeZone);
    }

    const existingMaterialization = await this.db.query.dailyLogMaterializations.findFirst({
      where: and(
        eq(dailyLogMaterializations.userId, userId),
        eq(dailyLogMaterializations.planDate, date),
      ),
    });

    if (!existingMaterialization && effectivePlan.meals.length > 0) {
      await this.db.insert(dailyLogMaterializations).values({
        userId,
        planDate: date,
      });
    }

    return this.findByDate(userId, date, timeZone);
  }

  async getDayOfWeekForWeeklyMealPlanEntry(userId: string, entryId: string) {
    const entry = await this.db.query.weeklyMealPlanEntries.findFirst({
      where: and(
        eq(weeklyMealPlanEntries.id, entryId),
        eq(weeklyMealPlanEntries.userId, userId),
      ),
      columns: { weeklyMealId: true },
    });
    if (!entry) return null;

    const meal = await this.db.query.weeklyMeals.findFirst({
      where: eq(weeklyMeals.id, entry.weeklyMealId),
      columns: { dayOfWeek: true },
    });
    return meal?.dayOfWeek ?? null;
  }

  async syncFutureDaysFromWeeklyTemplate(userId: string, dayOfWeek: number, timeZone: string) {
    const today = todayDateString(timeZone);
    const dates = upcomingDatesForWeekday(dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6, today);

    for (const date of dates) {
      if (await this.hasDayOverride(userId, date)) continue;
      await this.materializeFromPlan(userId, date, timeZone);
    }
  }

  async syncFutureDaysForWeeklyMealPlanEntry(userId: string, entryId: string, timeZone: string) {
    const dayOfWeek = await this.getDayOfWeekForWeeklyMealPlanEntry(userId, entryId);
    if (dayOfWeek === null) return;
    await this.syncFutureDaysFromWeeklyTemplate(userId, dayOfWeek, timeZone);
  }
}
