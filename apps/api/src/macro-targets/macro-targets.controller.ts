import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  macroTargetInputSchema,
  macroTargetQuerySchema,
  type MacroTargetInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { MacroTargetsService } from './macro-targets.service';

@Controller('macro-targets')
@UseGuards(JwtAuthGuard)
export class MacroTargetsController {
  constructor(private readonly service: MacroTargetsService) {}

  @Get()
  findByRange(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(macroTargetQuerySchema)) query: { from: string; to: string },
  ) {
    return this.service.findByRange(req.user.userId, query.from, query.to);
  }

  @Put()
  upsert(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(macroTargetInputSchema)) body: MacroTargetInput,
  ) {
    return this.service.upsert(req.user.userId, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
