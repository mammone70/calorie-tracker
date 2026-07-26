import { Module } from '@nestjs/common';
import { WaistCircumferenceController } from './waist-circumference.controller';
import { WaistCircumferenceService } from './waist-circumference.service';

@Module({
  controllers: [WaistCircumferenceController],
  providers: [WaistCircumferenceService],
  exports: [WaistCircumferenceService],
})
export class WaistCircumferenceModule {}
