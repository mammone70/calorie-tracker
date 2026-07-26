import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  bodyWeightDateQuerySchema,
  bodyWeightRangeQuerySchema,
  forUserIdQuerySchema,
  upsertBodyWeightLogSchema,
  type UpsertBodyWeightLogInput,
} from '@calorie-tracker/shared';
import type { DbClient } from '@calorie-tracker/db';
import { DB } from '../database/database.module';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { BodyWeightService } from './body-weight.service';

@Controller('body-weight')
@UseGuards(JwtAuthGuard)
export class BodyWeightController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: BodyWeightService,
  ) {}

  @Get()
  async findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(bodyWeightDateQuerySchema)) query: { date: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findByDate(userId, query.date);
  }

  @Get('range')
  async findRange(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(bodyWeightRangeQuerySchema))
    query: { from: string; to: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findRange(userId, query.from, query.to);
  }

  @Post()
  async upsert(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(upsertBodyWeightLogSchema)) body: UpsertBodyWeightLogInput,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.upsert(userId, body);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.remove(userId, id);
  }
}
