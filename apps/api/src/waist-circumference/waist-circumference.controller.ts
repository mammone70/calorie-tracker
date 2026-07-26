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
  forUserIdQuerySchema,
  upsertWaistCircumferenceLogSchema,
  waistCircumferenceDateQuerySchema,
  waistCircumferenceRangeQuerySchema,
  type UpsertWaistCircumferenceLogInput,
} from '@calorie-tracker/shared';
import type { DbClient } from '@calorie-tracker/db';
import { DB } from '../database/database.module';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { WaistCircumferenceService } from './waist-circumference.service';
import { z } from 'zod';

const latestQuerySchema = z.object({
  onOrBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  forUserId: z.string().uuid().optional(),
});

@Controller('waist-circumference')
@UseGuards(JwtAuthGuard)
export class WaistCircumferenceController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: WaistCircumferenceService,
  ) {}

  @Get()
  async findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(waistCircumferenceDateQuerySchema))
    query: { date: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findByDate(userId, query.date);
  }

  @Get('latest')
  async findLatest(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(latestQuerySchema)) query: { onOrBefore?: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findLatest(userId, query.onOrBefore);
  }

  @Get('range')
  async findRange(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(waistCircumferenceRangeQuerySchema))
    query: { from: string; to: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findRange(userId, query.from, query.to);
  }

  @Post()
  async upsert(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(upsertWaistCircumferenceLogSchema)) body: UpsertWaistCircumferenceLogInput,
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
