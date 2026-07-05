import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  forUserIdQuerySchema,
  macroTargetInputSchema,
  macroTargetQuerySchema,
  type MacroTargetInput,
} from '@calorie-tracker/shared';
import { type DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { MacroTargetsService } from './macro-targets.service';

const macroTargetRangeQuerySchema = macroTargetQuerySchema.merge(forUserIdQuerySchema);

@Controller('macro-targets')
@UseGuards(JwtAuthGuard)
export class MacroTargetsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly service: MacroTargetsService,
  ) {}

  @Get('effective')
  async findEffective(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(macroTargetRangeQuerySchema))
    query: { from: string; to: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findEffectiveByRange(userId, query.from, query.to);
  }

  @Get()
  async findByRange(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(macroTargetRangeQuerySchema))
    query: { from: string; to: string; forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.service.findByRange(userId, query.from, query.to);
  }

  @Put()
  async upsert(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Body(zodPipe(macroTargetInputSchema)) body: MacroTargetInput,
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
