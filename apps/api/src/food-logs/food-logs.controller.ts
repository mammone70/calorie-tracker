import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  foodLogEntryInputSchema,
  foodLogEntryInputBaseSchema,
  foodLogQuerySchema,
  materializeFoodLogsSchema,
  syncFutureFoodLogsSchema,
  type FoodLogEntryInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveRequestTimeZone } from '../common/timezone';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { FoodLogsService } from './food-logs.service';

@Controller('food-logs')
@UseGuards(JwtAuthGuard)
export class FoodLogsController {
  constructor(private readonly service: FoodLogsService) {}

  @Get()
  findByDate(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Query(zodPipe(foodLogQuerySchema)) query: { date: string },
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.findByDate(req.user.userId, query.date, timeZone);
  }

  @Post('materialize-from-plan')
  materializeFromPlan(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Body(zodPipe(materializeFoodLogsSchema)) body: { date: string },
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.materializeFromPlan(req.user.userId, body.date, timeZone);
  }

  @Post('sync-future-from-weekly')
  syncFutureFromWeekly(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Body(zodPipe(syncFutureFoodLogsSchema)) body: { dayOfWeek: number },
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.syncFutureDaysFromWeeklyTemplate(
      req.user.userId,
      body.dayOfWeek,
      timeZone,
    );
  }

  @Post()
  create(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Body(zodPipe(foodLogEntryInputSchema)) body: FoodLogEntryInput,
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.create(req.user.userId, body, undefined, timeZone);
  }

  @Patch(':id/confirm')
  confirm(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Param('id') id: string,
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.confirm(req.user.userId, id, timeZone);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Param('id') id: string,
    @Body(zodPipe(foodLogEntryInputBaseSchema.partial())) body: Partial<FoodLogEntryInput>,
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.update(req.user.userId, id, body, timeZone);
  }

  @Delete(':id')
  remove(
    @Req() req: { user: AuthUser; headers: Record<string, string | string[] | undefined> },
    @Param('id') id: string,
  ) {
    const timeZone = resolveRequestTimeZone(req.headers);
    return this.service.remove(req.user.userId, id, timeZone, { syncPlan: true });
  }
}