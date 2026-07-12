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
  createWorkoutTemplateExerciseSchema,
  createWorkoutTemplateSchema,
  forUserIdQuerySchema,
  updateWorkoutTemplateExerciseSchema,
  updateWorkoutTemplateSchema,
  type CreateWorkoutTemplateExerciseInput,
  type CreateWorkoutTemplateInput,
  type UpdateWorkoutTemplateExerciseInput,
  type UpdateWorkoutTemplateInput,
} from '@calorie-tracker/shared';
import type { DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { WorkoutsService } from './workouts.service';

@Controller('workout-templates')
@UseGuards(JwtAuthGuard)
export class WorkoutTemplatesController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly workoutsService: WorkoutsService,
  ) {}

  @Get()
  async list(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.listTemplates(userId);
  }

  @Get(':id')
  async get(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.getTemplate(userId, id);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(createWorkoutTemplateSchema)) body: CreateWorkoutTemplateInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.createTemplate(userId, body);
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(updateWorkoutTemplateSchema)) body: UpdateWorkoutTemplateInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.updateTemplate(userId, id, body);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.removeTemplate(userId, id);
  }

  @Get(':id/exercises')
  async listExercises(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.listTemplateExercises(userId, id);
  }

  @Post(':id/exercises')
  async addExercise(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(createWorkoutTemplateExerciseSchema)) body: CreateWorkoutTemplateExerciseInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.addTemplateExercise(userId, id, body);
  }
}

@Controller('workout-template-exercises')
@UseGuards(JwtAuthGuard)
export class WorkoutTemplateExercisesController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly workoutsService: WorkoutsService,
  ) {}

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(updateWorkoutTemplateExerciseSchema)) body: UpdateWorkoutTemplateExerciseInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.updateTemplateExercise(userId, id, body);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.workoutsService.removeTemplateExercise(userId, id);
  }
}
