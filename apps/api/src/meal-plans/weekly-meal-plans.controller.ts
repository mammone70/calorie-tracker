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
  weeklyMealPlanEntryInputSchema,
  type WeeklyMealPlanEntryInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { WeeklyMealPlansService } from './weekly-meal-plans.service';
import { z } from 'zod';

const dayOfWeekQuerySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
});

@Controller('weekly-meal-plans')
@UseGuards(JwtAuthGuard)
export class WeeklyMealPlansController {
  constructor(private readonly service: WeeklyMealPlansService) {}

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(dayOfWeekQuerySchema)) query: { dayOfWeek?: number },
  ) {
    return this.service.findAll(req.user.userId, query.dayOfWeek);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(weeklyMealPlanEntryInputSchema)) body: WeeklyMealPlanEntryInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(weeklyMealPlanEntryInputSchema.partial())) body: Partial<WeeklyMealPlanEntryInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
