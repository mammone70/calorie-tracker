import { Module } from '@nestjs/common';
import { MacroTargetsController } from './macro-targets.controller';
import { WeeklyMacroTargetsController } from './weekly-macro-targets.controller';
import { MacroTargetsService } from './macro-targets.service';
import { WeeklyMacroTargetsService } from './weekly-macro-targets.service';

@Module({
  controllers: [MacroTargetsController, WeeklyMacroTargetsController],
  providers: [MacroTargetsService, WeeklyMacroTargetsService],
  exports: [MacroTargetsService, WeeklyMacroTargetsService],
})
export class MacroTargetsModule {}
