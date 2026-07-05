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
  setWeeklyDayMealCountSchema,
  weeklyMealInputSchema,
  type SetWeeklyDayMealCountInput,
  type WeeklyMealInput,
} from '@calorie-tracker/shared';
import { type DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { WeeklyMealsService } from './weekly-meals.service';
import { z } from 'zod';

const dayOfWeekQuerySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  })
  .merge(forUserIdQuerySchema);

@Controller('weekly-meals')
@UseGuards(JwtAuthGuard)
export class WeeklyMealsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: WeeklyMealsService,
  ) {}

  @Get()
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(dayOfWeekQuerySchema)) query: { dayOfWeek?: number; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findAll(userId, query.dayOfWeek);
  }

  @Post('set-count')
  async setMealCount(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(setWeeklyDayMealCountSchema)) body: SetWeeklyDayMealCountInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.setMealCount(userId, body);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(weeklyMealInputSchema)) body: WeeklyMealInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.create(userId, body);
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(weeklyMealInputSchema.partial())) body: Partial<WeeklyMealInput>,
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
