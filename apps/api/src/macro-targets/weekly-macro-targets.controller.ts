import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  forUserIdQuerySchema,
  weeklyMacroTargetInputSchema,
  type WeeklyMacroTargetInput,
} from '@calorie-tracker/shared';
import { type DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { WeeklyMacroTargetsService } from './weekly-macro-targets.service';

@Controller('weekly-macro-targets')
@UseGuards(JwtAuthGuard)
export class WeeklyMacroTargetsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: WeeklyMacroTargetsService,
  ) {}

  @Get()
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findAll(userId);
  }

  @Put()
  async upsert(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(weeklyMacroTargetInputSchema)) body: WeeklyMacroTargetInput,
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
