import { Module } from '@nestjs/common';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { FoodLogsController } from './food-logs.controller';
import { FoodLogsService } from './food-logs.service';

@Module({
  imports: [MealPlansModule],
  controllers: [FoodLogsController],
  providers: [FoodLogsService],
  exports: [FoodLogsService],
})
export class FoodLogsModule {}
