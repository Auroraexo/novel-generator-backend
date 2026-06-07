import { Module } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { ChapterController } from './chapter.controller';
import { LlmModule } from '../llm/llm.module';
import { PromptModule } from '../prompt/prompt.module';
import { MemoryModule } from '../memory/memory.module';
import { SummaryModule } from '../summary/summary.module';

@Module({
  imports: [LlmModule, PromptModule, MemoryModule, SummaryModule],
  controllers: [ChapterController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
