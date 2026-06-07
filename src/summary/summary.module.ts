import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { LlmModule } from '../llm/llm.module';
import { PromptModule } from '../prompt/prompt.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [LlmModule, PromptModule, MemoryModule],
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
