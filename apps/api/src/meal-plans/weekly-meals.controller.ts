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
  setWeeklyDayMealCountSchema,
  weeklyMealInputSchema,
  type SetWeeklyDayMealCountInput,
  type WeeklyMealInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { WeeklyMealsService } from './weekly-meals.service';
import { z } from 'zod';

const dayOfWeekQuerySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
});

@Controller('weekly-meals')
@UseGuards(JwtAuthGuard)
export class WeeklyMealsController {
  constructor(private readonly service: WeeklyMealsService) {}

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(dayOfWeekQuerySchema)) query: { dayOfWeek?: number },
  ) {
    return this.service.findAll(req.user.userId, query.dayOfWeek);
  }

  @Post('set-count')
  setMealCount(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(setWeeklyDayMealCountSchema)) body: SetWeeklyDayMealCountInput,
  ) {
    return this.service.setMealCount(req.user.userId, body);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(weeklyMealInputSchema)) body: WeeklyMealInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(weeklyMealInputSchema.partial())) body: Partial<WeeklyMealInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
