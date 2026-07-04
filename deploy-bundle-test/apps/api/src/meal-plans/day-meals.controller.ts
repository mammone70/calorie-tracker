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
  dayMealInputSchema,
  mealPlanQuerySchema,
  setDayMealCountSchema,
  type DayMealInput,
  type SetDayMealCountInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DayMealsService } from './day-meals.service';

@Controller('day-meals')
@UseGuards(JwtAuthGuard)
export class DayMealsController {
  constructor(private readonly service: DayMealsService) {}

  @Get()
  findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanQuerySchema)) query: { date: string },
  ) {
    return this.service.findByDate(req.user.userId, query.date);
  }

  @Post('set-count')
  setMealCount(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(setDayMealCountSchema)) body: SetDayMealCountInput,
  ) {
    return this.service.setMealCount(req.user.userId, body);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(dayMealInputSchema)) body: DayMealInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(dayMealInputSchema.partial())) body: Partial<DayMealInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
