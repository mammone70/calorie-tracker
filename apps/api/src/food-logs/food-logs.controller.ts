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
  type FoodLogEntryInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { FoodLogsService } from './food-logs.service';

@Controller('food-logs')
@UseGuards(JwtAuthGuard)
export class FoodLogsController {
  constructor(private readonly service: FoodLogsService) {}

  @Get()
  findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(foodLogQuerySchema)) query: { date: string },
  ) {
    return this.service.findByDate(req.user.userId, query.date);
  }

  @Post('materialize-from-plan')
  materializeFromPlan(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(materializeFoodLogsSchema)) body: { date: string },
  ) {
    return this.service.materializeFromPlan(req.user.userId, body.date);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(foodLogEntryInputSchema)) body: FoodLogEntryInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id/confirm')
  confirm(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.confirm(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(foodLogEntryInputBaseSchema.partial())) body: Partial<FoodLogEntryInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
