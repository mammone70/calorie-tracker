import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  mealPlanEntryInputSchema,
  mealPlanQuerySchema,
  resolveEffectiveMealPlan,
  dayOfWeekFromDate,
  type MealPlanEntryInput,
} from '@calorie-tracker/shared';
import { z } from 'zod';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { MealPlansService } from './meal-plans.service';
import { WeeklyMealPlansService } from './weekly-meal-plans.service';
import { WeeklyMealsService } from './weekly-meals.service';
import { DayMealsService } from './day-meals.service';

const dateBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

@Controller('meal-plans')
@UseGuards(JwtAuthGuard)
export class MealPlansController {
  constructor(
    private readonly service: MealPlansService,
    private readonly weeklyEntriesService: WeeklyMealPlansService,
    private readonly weeklyMealsService: WeeklyMealsService,
    private readonly dayMealsService: DayMealsService,
  ) {}

  @Get('effective')
  async findEffective(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanQuerySchema)) query: { date: string },
  ) {
    const dayOfWeek = dayOfWeekFromDate(query.date);
    const [dayMeals, dateEntries, weeklyMeals, weeklyEntries] = await Promise.all([
      this.dayMealsService.findByDate(req.user.userId, query.date),
      this.service.findByDate(req.user.userId, query.date),
      this.weeklyMealsService.findAll(req.user.userId, dayOfWeek),
      this.weeklyEntriesService.findAll(req.user.userId, dayOfWeek),
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
    @Body(zodPipe(dateBodySchema)) body: { date: string },
  ) {
    const existingEntries = await this.service.findByDate(req.user.userId, body.date);
    const existingMeals = await this.dayMealsService.findByDate(req.user.userId, body.date);
    if (existingEntries.length > 0 || existingMeals.length > 0) {
      return { dayMeals: existingMeals, entries: existingEntries };
    }

    const dayOfWeek = dayOfWeekFromDate(body.date);
    const [weeklyMeals, weeklyEntries] = await Promise.all([
      this.weeklyMealsService.findAll(req.user.userId, dayOfWeek),
      this.weeklyEntriesService.findAll(req.user.userId, dayOfWeek),
    ]);

    const mealIdMap = new Map<string, string>();
    const createdMeals = [];
    for (const meal of weeklyMeals) {
      const created = await this.dayMealsService.create(req.user.userId, {
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
        await this.service.create(req.user.userId, {
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
    @Body(zodPipe(dateBodySchema)) body: { date: string },
  ) {
    await this.service.removeAllForDate(req.user.userId, body.date);
    await this.dayMealsService.removeAllForDate(req.user.userId, body.date);
    return { ok: true };
  }

  @Get()
  findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanQuerySchema)) query: { date: string },
  ) {
    return this.service.findByDate(req.user.userId, query.date);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(mealPlanEntryInputSchema)) body: MealPlanEntryInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(mealPlanEntryInputSchema.partial())) body: Partial<MealPlanEntryInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
