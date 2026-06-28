import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb, type DbClient } from '@calorie-tracker/db';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DbClient => {
        const url =
          config.get<string>('DATABASE_URL') ??
          'postgresql://calorie:calorie@localhost:5432/calorie_tracker';
        return createDb(url);
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
