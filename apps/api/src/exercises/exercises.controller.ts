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
  createExerciseSchema,
  exerciseSearchQuerySchema,
  forUserIdQuerySchema,
  updateExerciseSchema,
  type CreateExerciseInput,
  type UpdateExerciseInput,
} from '@calorie-tracker/shared';
import type { DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { ExercisesService } from './exercises.service';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly exercisesService: ExercisesService,
  ) {}

  @Get()
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.findAll(userId);
  }

  @Get('search')
  async search(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(exerciseSearchQuerySchema))
    query: { q: string; limit: number; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.search(userId, query.q, query.limit);
  }

  @Get(':id')
  async findOne(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.findOne(userId, id);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(createExerciseSchema)) body: CreateExerciseInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.create(userId, body, { role: req.user.role });
  }

  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
    @Body(zodPipe(updateExerciseSchema)) body: UpdateExerciseInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.update(userId, id, body, { role: req.user.role });
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.exercisesService.remove(userId, id, { role: req.user.role });
  }
}
