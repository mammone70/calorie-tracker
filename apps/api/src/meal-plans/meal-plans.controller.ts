import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  forUserIdQuerySchema,
  mealPlanEntryInputSchema,
  mealPlanQuerySchema,
  resolveEffectiveMealPlan,
  dayOfWeekFromDate,
  type MealPlanEntryInput,
} from '@calorie-tracker/shared';
import { type DbClient } from '@calorie-tracker/db';
import { z } from 'zod';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { MealPlansService } from './meal-plans.service';
import { WeeklyMealPlansService } from './weekly-meal-plans.service';
import { WeeklyMealsService } from './weekly-meals.service';
import { DayMealsService } from './day-meals.service';

const dateBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const mealPlanDateQuerySchema = mealPlanQuerySchema.merge(forUserIdQuerySchema);

@Controller('meal-plans')
@UseGuards(JwtAuthGuard)
export class MealPlansController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: MealPlansService,
    private readonly weeklyEntriesService: WeeklyMealPlansService,
    private readonly weeklyMealsService: WeeklyMealsService,
    private readonly dayMealsService: DayMealsService,
  ) {}

  @Get('effective')
  async findEffective(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanDateQuerySchema)) query: { date: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    const dayOfWeek = dayOfWeekFromDate(query.date);
    const [dayMeals, dateEntries, weeklyMeals, weeklyEntries] = await Promise.all([
      this.dayMealsService.findByDate(userId, query.date),
      this.service.findByDate(userId, query.date),
      this.weeklyMealsService.findAll(userId, dayOfWeek),
      this.weeklyEntriesService.findAll(userId, dayOfWeek),
    ]);
    return resolveEffectiveMealPlan(
      query.date,
      dayMeals,
      dateEntries,
      weeklyMeals,
      weeklyEntries,
    );
  }

  @Post('materialize-weekly')
  async materializeWeekly(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(dateBodySchema)) body: { date: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    const existingEntries = await this.service.findByDate(userId, body.date);
    const existingMeals = await this.dayMealsService.findByDate(userId, body.date);
    if (existingEntries.length > 0 || existingMeals.length > 0) {
      return { dayMeals: existingMeals, entries: existingEntries };
    }

    const dayOfWeek = dayOfWeekFromDate(body.date);
    const [weeklyMeals, weeklyEntries] = await Promise.all([
      this.weeklyMealsService.findAll(userId, dayOfWeek),
      this.weeklyEntriesService.findAll(userId, dayOfWeek),
    ]);

    const mealIdMap = new Map<string, string>();
    const createdMeals = [];
    for (const meal of weeklyMeals) {
      const created = await this.dayMealsService.create(userId, {
        planDate: body.date,
        mealIndex: meal.mealIndex,
        name: meal.name,
        mealTime: meal.mealTime ?? undefined,
      });
      mealIdMap.set(meal.id, created.id);
      createdMeals.push(created);
    }

    const createdEntries = [];
    for (const entry of weeklyEntries) {
      const dayMealId = mealIdMap.get(entry.weeklyMealId);
      if (!dayMealId) continue;
      createdEntries.push(
        await this.service.create(userId, {
          planDate: body.date,
          dayMealId,
          foodId: entry.foodId,
          quantity: entry.quantity,
          unit: entry.unit,
        }),
      );
    }

    return { dayMeals: createdMeals, entries: createdEntries };
  }

  @Post('reset-to-weekly')
  async resetToWeekly(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(dateBodySchema)) body: { date: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    await this.service.removeAllForDate(userId, body.date);
    await this.dayMealsService.removeAllForDate(userId, body.date);
    return { ok: true };
  }

  @Get()
  async findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanDateQuerySchema)) query: { date: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findByDate(userId, query.date);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(mealPlanEntryInputSchema)) body: MealPlanEntryInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.create(userId, body);
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(mealPlanEntryInputSchema.partial())) body: Partial<MealPlanEntryInput>,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.update(userId, id, body);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.remove(userId, id);
  }
}
