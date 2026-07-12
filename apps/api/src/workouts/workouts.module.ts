import { Module } from '@nestjs/common';
import {
  WorkoutTemplateExercisesController,
  WorkoutTemplatesController,
} from './workout-templates.controller';
import { WorkoutSetsController, WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  controllers: [
    WorkoutTemplatesController,
    WorkoutTemplateExercisesController,
    WorkoutsController,
    WorkoutSetsController,
  ],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
