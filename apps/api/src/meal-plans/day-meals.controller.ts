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
  forwardRef,
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
import { MealPlansService } from './meal-plans.service';
import { FoodLogsService } from '../food-logs/food-logs.service';

@Controller('day-meals')
@UseGuards(JwtAuthGuard)
export class DayMealsController {
  constructor(
    private readonly service: DayMealsService,
    private readonly mealPlansService: MealPlansService,
    @Inject(forwardRef(() => FoodLogsService))
    private readonly foodLogsService: FoodLogsService,
  ) {}

  @Get()
  findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanQuerySchema)) query: { date: string },
  ) {
    return this.service.findByDate(req.user.userId, query.date);
  }

  @Post('set-count')
  async setMealCount(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(setDayMealCountSchema)) body: SetDayMealCountInput,
  ) {
    const userId = req.user.userId;
    const current = await this.service.findByDate(userId, body.planDate);

    if (current.length > body.mealCount) {
      const toRemove = current
        .filter((meal) => meal.mealIndex >= body.mealCount)
        .sort((a, b) => b.mealIndex - a.mealIndex);

      for (const meal of toRemove) {
        await this.foodLogsService.removeLogsForDayMeal(userId, meal.id);
        const planEntries = await this.mealPlansService.findByDate(userId, body.planDate);
        for (const entry of planEntries) {
          if (entry.dayMealId === meal.id) {
            await this.mealPlansService.remove(userId, entry.id);
          }
        }
      }
    }

    return this.service.setMealCount(userId, body);
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
  async remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    const userId = req.user.userId;
    await this.foodLogsService.removeLogsForDayMeal(userId, id);
    const removed = await this.service.remove(userId, id);
    const planEntries = await this.mealPlansService.findByDate(userId, removed.planDate);
    for (const entry of planEntries) {
      if (entry.dayMealId === id) {
        await this.mealPlansService.remove(userId, entry.id);
      }
    }
    return removed;
  }
}
