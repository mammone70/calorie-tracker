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
  mealPlanEntryInputSchema,
  mealPlanQuerySchema,
  type MealPlanEntryInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { MealPlansService } from './meal-plans.service';

@Controller('meal-plans')
@UseGuards(JwtAuthGuard)
export class MealPlansController {
  constructor(private readonly service: MealPlansService) {}

  @Get()
  findByDate(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(mealPlanQuerySchema)) query: { date: string },
  ) {
    return this.service.findByDate(req.user.userId, query.date);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(mealPlanEntryInputSchema)) body: MealPlanEntryInput,
  ) {
    return this.service.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(mealPlanEntryInputSchema.partial())) body: Partial<MealPlanEntryInput>,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
