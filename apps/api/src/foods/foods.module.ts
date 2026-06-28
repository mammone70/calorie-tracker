import { Module } from '@nestjs/common';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { FoodSearchService } from './food-search.service';

@Module({
  controllers: [FoodsController],
  providers: [FoodsService, FoodSearchService],
  exports: [FoodsService],
})
export class FoodsModule {}
