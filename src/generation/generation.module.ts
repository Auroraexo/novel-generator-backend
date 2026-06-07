import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { GenerationController } from './generation.controller';
import { SettingModule } from '../setting/setting.module';
import { OutlineModule } from '../outline/outline.module';
import { ChapterModule } from '../chapter/chapter.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'novel-generation' }),
    SettingModule,
    OutlineModule,
    ChapterModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationProcessor],
  exports: [GenerationService],
})
export class GenerationModule {}
