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
  addWorkoutSetSchema,
  confirmWorkoutSetSchema,
  createDayWorkoutExerciseSchema,
  createDayWorkoutSessionSchema,
  effectiveWorkoutsQuerySchema,
  forUserIdQuerySchema,
  materializeWorkoutsSchema,
  updateWorkoutSetLogSchema,
  type AddWorkoutSetInput,
  type ConfirmWorkoutSetInput,
  type CreateDayWorkoutExerciseInput,
  type CreateDayWorkoutSessionInput,
  type UpdateWorkoutSetLogInput,
} from '@calorie-tracker/shared';
import type { DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly workoutsService: WorkoutsService,
  ) {}

  @Get('effective')
  async effective(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(effectiveWorkoutsQuerySchema))
    query: { date: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.getEffective(userId, query.date);
  }

  @Post('materialize')
  async materialize(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(materializeWorkoutsSchema)) body: { date: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.materialize(userId, body.date);
  }

  @Post('reset-to-template')
  async reset(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(materializeWorkoutsSchema)) body: { date: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.resetToTemplate(userId, body.date);
  }

  @Post('sessions')
  async createSession(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(createDayWorkoutSessionSchema)) body: CreateDayWorkoutSessionInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.createSession(userId, body);
  }

  @Delete('sessions/:id')
  async removeSession(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.removeSession(userId, id);
  }

  @Post('sessions/:id/exercises')
  async addExercise(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(createDayWorkoutExerciseSchema)) body: CreateDayWorkoutExerciseInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.addDayExercise(userId, id, body);
  }

  @Delete('day-exercises/:id')
  async removeExercise(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.removeDayExercise(userId, id);
  }

  @Post('day-exercises/:id/sets')
  async addSet(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(addWorkoutSetSchema)) body: AddWorkoutSetInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.addSet(userId, id, body);
  }
}

@Controller('workout-sets')
@UseGuards(JwtAuthGuard)
export class WorkoutSetsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly workoutsService: WorkoutsService,
  ) {}

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(updateWorkoutSetLogSchema)) body: UpdateWorkoutSetLogInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.updateSet(userId, id, body);
  }

  @Post(':id/confirm')
  async confirm(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(confirmWorkoutSetSchema)) body: ConfirmWorkoutSetInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.confirmSet(userId, id, body);
  }

  @Post(':id/unconfirm')
  async unconfirm(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.unconfirmSet(userId, id);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.removeSet(userId, id);
  }
}
