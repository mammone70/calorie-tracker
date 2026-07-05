import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createFoodSchema,
  foodSearchQuerySchema,
  forUserIdQuerySchema,
  updateFoodSchema,
  type CreateFoodInput,
  type UpdateFoodInput,
} from '@calorie-tracker/shared';
import { type DbClient } from '@calorie-tracker/db';
import { zodPipe } from '../common/zod-validation.pipe';
import { resolveActingUserId } from '../common/acting-user';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { DB } from '../database/database.module';
import { FoodsService } from './foods.service';
import { FoodSearchService } from './food-search.service';

@Controller('foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly foodsService: FoodsService,
    private readonly searchService: FoodSearchService,
  ) {}

  @Get()
  async findAll(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.foodsService.findAll(userId);
  }

  @Get('search')
  search(@Query(zodPipe(foodSearchQuerySchema)) query: { q: string; limit: number }) {
    return this.searchService.search(query.q, query.limit);
  }

  @Get(':id')
  async findOne(
    @Req() req: { user: AuthUser },
    @Query(zodPipe(forUserIdQuerySchema)) query: { forUserId?: string },
    @Param('id') id: string,
  ) {
    const userId = await resolveActingUserId(this.db, req.user, query.forUserId);
    return this.foodsService.findOne(userId, id);
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body(zodPipe(createFoodSchema)) body: CreateFoodInput,
  ) {
    return this.foodsService.create(req.user.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body(zodPipe(updateFoodSchema)) body: UpdateFoodInput,
  ) {
    return this.foodsService.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.foodsService.remove(req.user.userId, id);
  }
}
