import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { syncPushSchema, syncQuerySchema, type SyncPushInput } from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly service: SyncService) {}

  @Get()
  pull(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(syncQuerySchema)) query: { since?: string },
  ) {
    return this.service.pull(req.user.userId, query.since);
  }

  @Post('push')
  push(@Req() req: { user: AuthUser }, @Body(zodPipe(syncPushSchema)) body: SyncPushInput) {
    return this.service.push(req.user.userId, body);
  }
}
