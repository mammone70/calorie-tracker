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
  createFoodSchema,
  foodSearchQuerySchema,
  updateFoodSchema,
  type CreateFoodInput,
  type UpdateFoodInput,
} from '@calorie-tracker/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, type AuthUser } from '../auth/jwt-auth.guard';
import { FoodsService } from './foods.service';
import { FoodSearchService } from './food-search.service';

@Controller('foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(
    private readonly foodsService: FoodsService,
    private readonly searchService: FoodSearchService,
  ) {}

  @Get()
  findAll(@Req() req: { user: AuthUser }) {
    return this.foodsService.findAll(req.user.userId);
  }

  @Get('search')
  search(@Query(zodPipe(foodSearchQuerySchema)) query: { q: string; limit: number }) {
    return this.searchService.search(query.q, query.limit);
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.foodsService.findOne(req.user.userId, id);
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
