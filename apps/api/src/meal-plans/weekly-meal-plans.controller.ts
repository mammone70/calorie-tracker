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
  weeklyMealPlanEntryInputSchema,
  type WeeklyMealPlanEntryInput,
} from '@calorie-tracker/shared';
import { type DbClient, weeklyMeals } from '@calorie-tracker/db';
import { and, eq, isNull } from 'drizzle-orm';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { resolveRequestTimeZone } from '../common/timezone';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { FoodLogsService } from '../food-logs/food-logs.service';
import { WeeklyMealPlansService } from './weekly-meal-plans.service';
import { z } from 'zod';

const dayOfWeekQuerySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  })
  .merge(forUserIdQuerySchema);

@Controller('weekly-meal-plans')
@UseGuards(JwtAuthGuard)
export class WeeklyMealPlansController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: WeeklyMealPlansService,
    private readonly foodLogsService: FoodLogsService,
  ) {}

  private async dayOfWeekForWeeklyMeal(userId: string, weeklyMealId: string) {
    const meal = await this.db.query.weeklyMeals.findFirst({
      where: and(
        eq(weeklyMeals.id, weeklyMealId),
        eq(weeklyMeals.userId, userId),
        isNull(weeklyMeals.deletedAt),
      ),
      columns: { dayOfWeek: true },
    });
    return meal?.dayOfWeek ?? null;
  }

  private async syncFutureDays(
    userId: string,
    dayOfWeek: number | null,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (dayOfWeek === null) return;
    const timeZone = resolveRequestTimeZone(headers);
    await this.foodLogsService.syncFutureDaysFromWeeklyTemplate(userId, dayOfWeek, timeZone);
  }

  @Get()
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(dayOfWeekQuerySchema)) query: { dayOfWeek?: number; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findAll(userId, query.dayOfWeek);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(weeklyMealPlanEntryInputSchema)) body: WeeklyMealPlanEntryInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    const created = await this.service.create(userId, body);
    const dayOfWeek = await this.dayOfWeekForWeeklyMeal(userId, body.weeklyMealId);
    await this.syncFutureDays(userId, dayOfWeek, req.headers);
    return created;
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(weeklyMealPlanEntryInputSchema.partial())) body: Partial<WeeklyMealPlanEntryInput>,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    const updated = await this.service.update(userId, id, body);
    const timeZone = resolveRequestTimeZone(req.headers);
    await this.foodLogsService.syncFutureDaysForWeeklyMealPlanEntry(userId, id, timeZone);
    return updated;
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    const dayOfWeek = await this.foodLogsService.getDayOfWeekForWeeklyMealPlanEntry(userId, id);
    const removed = await this.service.remove(userId, id);
    await this.syncFutureDays(userId, dayOfWeek, req.headers);
    return removed;
  }
}
