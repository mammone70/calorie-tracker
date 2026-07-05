import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { MacroTargetsModule } from './macro-targets/macro-targets.module';
import { FoodsModule } from './foods/foods.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { FoodLogsModule } from './food-logs/food-logs.module';
import { SyncModule } from './sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    MacroTargetsModule,
    FoodsModule,
    MealPlansModule,
    FoodLogsModule,
    SyncModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
