import { Module } from '@nestjs/common';
import { MealPlansController } from './meal-plans.controller';
import { WeeklyMealPlansController } from './weekly-meal-plans.controller';
import { WeeklyMealsController } from './weekly-meals.controller';
import { DayMealsController } from './day-meals.controller';
import { MealPlansService } from './meal-plans.service';
import { WeeklyMealPlansService } from './weekly-meal-plans.service';
import { WeeklyMealsService } from './weekly-meals.service';
import { DayMealsService } from './day-meals.service';

@Module({
  controllers: [
    MealPlansController,
    WeeklyMealPlansController,
    WeeklyMealsController,
    DayMealsController,
  ],
  providers: [
    MealPlansService,
    WeeklyMealPlansService,
    WeeklyMealsService,
    DayMealsService,
  ],
  exports: [
    MealPlansService,
    WeeklyMealPlansService,
    WeeklyMealsService,
    DayMealsService,
  ],
})
export class MealPlansModule {}
