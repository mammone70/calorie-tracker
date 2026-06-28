import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, or, isNotNull } from 'drizzle-orm';
import {
  macroTargets,
  weeklyMacroTargets,
  weeklyMeals,
  weeklyMealPlanEntries,
  dayMeals,
  foods,
  mealPlanEntries,
  foodLogEntries,
  type DbClient,
} from '@calorie-tracker/db';
import type { SyncPushInput } from '@calorie-tracker/shared';
import { DB } from '../database/database.module';
import {
  serializeMacroTarget,
  serializeWeeklyMacroTarget,
  serializeWeeklyMeal,
  serializeDayMeal,
  serializeWeeklyMealPlanEntry,
  serializeFood,
  serializeMealPlanEntry,
  serializeFoodLogEntry,
} from '../common/serializers';
import { MacroTargetsService } from '../macro-targets/macro-targets.service';
import { WeeklyMacroTargetsService } from '../macro-targets/weekly-macro-targets.service';
import { WeeklyMealsService } from '../meal-plans/weekly-meals.service';
import { WeeklyMealPlansService } from '../meal-plans/weekly-meal-plans.service';
import { DayMealsService } from '../meal-plans/day-meals.service';
import { FoodsService } from '../foods/foods.service';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { FoodLogsService } from '../food-logs/food-logs.service';

@Injectable()
export class SyncService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly macroTargetsService: MacroTargetsService,
    private readonly weeklyMacroTargetsService: WeeklyMacroTargetsService,
    private readonly weeklyMealsService: WeeklyMealsService,
    private readonly weeklyMealPlansService: WeeklyMealPlansService,
    private readonly dayMealsService: DayMealsService,
    private readonly foodsService: FoodsService,
    private readonly mealPlansService: MealPlansService,
    private readonly foodLogsService: FoodLogsService,
  ) {}

  async pull(userId: string, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const changedSince = (table: typeof macroTargets) =>
      and(
        eq(table.userId, userId),
        or(gt(table.updatedAt, sinceDate), isNotNull(table.deletedAt)),
      );

    const [
      macroRows,
      weeklyRows,
      weeklyMealRows,
      weeklyMealPlanRows,
      dayMealRows,
      foodRows,
      mealRows,
      logRows,
    ] = await Promise.all([
      this.db.query.macroTargets.findMany({ where: changedSince(macroTargets) }),
      this.db.query.weeklyMacroTargets.findMany({
        where: and(
          eq(weeklyMacroTargets.userId, userId),
          or(gt(weeklyMacroTargets.updatedAt, sinceDate), isNotNull(weeklyMacroTargets.deletedAt)),
        ),
      }),
      this.db.query.weeklyMeals.findMany({
        where: and(
          eq(weeklyMeals.userId, userId),
          or(gt(weeklyMeals.updatedAt, sinceDate), isNotNull(weeklyMeals.deletedAt)),
        ),
      }),
      this.db.query.weeklyMealPlanEntries.findMany({
        where: and(
          eq(weeklyMealPlanEntries.userId, userId),
          or(
            gt(weeklyMealPlanEntries.updatedAt, sinceDate),
            isNotNull(weeklyMealPlanEntries.deletedAt),
          ),
        ),
      }),
      this.db.query.dayMeals.findMany({
        where: and(
          eq(dayMeals.userId, userId),
          or(gt(dayMeals.updatedAt, sinceDate), isNotNull(dayMeals.deletedAt)),
        ),
      }),
      this.db.query.foods.findMany({
        where: and(
          eq(foods.userId, userId),
          or(gt(foods.updatedAt, sinceDate), isNotNull(foods.deletedAt)),
        ),
      }),
      this.db.query.mealPlanEntries.findMany({
        where: and(
          eq(mealPlanEntries.userId, userId),
          or(gt(mealPlanEntries.updatedAt, sinceDate), isNotNull(mealPlanEntries.deletedAt)),
        ),
      }),
      this.db.query.foodLogEntries.findMany({
        where: and(
          eq(foodLogEntries.userId, userId),
          or(gt(foodLogEntries.updatedAt, sinceDate), isNotNull(foodLogEntries.deletedAt)),
        ),
      }),
    ]);

    return {
      macroTargets: macroRows.map(serializeMacroTarget),
      weeklyMacroTargets: weeklyRows.map(serializeWeeklyMacroTarget),
      weeklyMeals: weeklyMealRows.map(serializeWeeklyMeal),
      weeklyMealPlanEntries: weeklyMealPlanRows.map(serializeWeeklyMealPlanEntry),
      dayMeals: dayMealRows.map(serializeDayMeal),
      foods: foodRows.map(serializeFood),
      mealPlanEntries: mealRows.map(serializeMealPlanEntry),
      foodLogEntries: logRows.map(serializeFoodLogEntry),
      serverTime: new Date().toISOString(),
    };
  }

  async push(userId: string, input: SyncPushInput) {
    const results = [];

    for (const mutation of input.mutations) {
      const { entityType, action, entityId, payload } = mutation;

      try {
        if (entityType === 'macro_targets') {
          if (action === 'delete') {
            results.push(await this.macroTargetsService.remove(userId, entityId));
          } else {
            results.push(
              await this.macroTargetsService.upsert(userId, payload as never, entityId),
            );
          }
        } else if (entityType === 'weekly_macro_targets') {
          if (action === 'delete') {
            results.push(await this.weeklyMacroTargetsService.remove(userId, entityId));
          } else {
            results.push(
              await this.weeklyMacroTargetsService.upsert(userId, payload as never, entityId),
            );
          }
        } else if (entityType === 'weekly_meals') {
          if (action === 'delete') {
            results.push(await this.weeklyMealsService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(await this.weeklyMealsService.create(userId, payload as never, entityId));
          } else {
            results.push(
              await this.weeklyMealsService.update(userId, entityId, payload as never),
            );
          }
        } else if (entityType === 'weekly_meal_plan_entries') {
          if (action === 'delete') {
            results.push(await this.weeklyMealPlansService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(
              await this.weeklyMealPlansService.create(userId, payload as never, entityId),
            );
          } else {
            results.push(
              await this.weeklyMealPlansService.update(userId, entityId, payload as never),
            );
          }
        } else if (entityType === 'day_meals') {
          if (action === 'delete') {
            results.push(await this.dayMealsService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(await this.dayMealsService.create(userId, payload as never, entityId));
          } else {
            results.push(await this.dayMealsService.update(userId, entityId, payload as never));
          }
        } else if (entityType === 'foods') {
          if (action === 'delete') {
            results.push(await this.foodsService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(await this.foodsService.create(userId, payload as never, entityId));
          } else {
            results.push(await this.foodsService.update(userId, entityId, payload as never));
          }
        } else if (entityType === 'meal_plan_entries') {
          if (action === 'delete') {
            results.push(await this.mealPlansService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(
              await this.mealPlansService.create(userId, payload as never, entityId),
            );
          } else {
            results.push(
              await this.mealPlansService.update(userId, entityId, payload as never),
            );
          }
        } else if (entityType === 'food_log_entries') {
          if (action === 'delete') {
            results.push(await this.foodLogsService.remove(userId, entityId));
          } else if (action === 'create') {
            results.push(
              await this.foodLogsService.create(userId, payload as never, entityId),
            );
          } else {
            results.push(
              await this.foodLogsService.update(userId, entityId, payload as never),
            );
          }
        }
      } catch (error) {
        results.push({ entityId, error: String(error) });
      }
    }

    return { processed: results.length, results };
  }
}
