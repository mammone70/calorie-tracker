import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { MacroTargetsModule } from '../macro-targets/macro-targets.module';
import { FoodsModule } from '../foods/foods.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { FoodLogsModule } from '../food-logs/food-logs.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    MacroTargetsModule,
    FoodsModule,
    MealPlansModule,
    FoodLogsModule,
    ExercisesModule,
    WorkoutsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
