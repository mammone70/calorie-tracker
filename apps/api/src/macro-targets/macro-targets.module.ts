import { Module } from '@nestjs/common';
import { MacroTargetsController } from './macro-targets.controller';
import { MacroTargetsService } from './macro-targets.service';

@Module({
  controllers: [MacroTargetsController],
  providers: [MacroTargetsService],
  exports: [MacroTargetsService],
})
export class MacroTargetsModule {}
