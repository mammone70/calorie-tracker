import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { weeklyMacroTargetInputSchema, type WeeklyMacroTargetInput } from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { WeeklyMacroTargetsService } from './weekly-macro-targets.service';

@Controller('weekly-macro-targets')
@UseGuards(JwtAuthGuard)
export class WeeklyMacroTargetsController {
  constructor(private readonly service: WeeklyMacroTargetsService) {}

  @Get()
  findAll(@Req() req: { user: AuthUser }) {
    return this.service.findAll(req.user.userId);
  }

  @Put()
  upsert(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(weeklyMacroTargetInputSchema)) body: WeeklyMacroTargetInput,
  ) {
    return this.service.upsert(req.user.userId, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
