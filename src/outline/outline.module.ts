import { Module } from '@nestjs/common';
import { OutlineService } from './outline.service';
import { OutlineController } from './outline.controller';
import { LlmModule } from '../llm/llm.module';
import { PromptModule } from '../prompt/prompt.module';

@Module({
  imports: [LlmModule, PromptModule],
  controllers: [OutlineController],
  providers: [OutlineService],
  exports: [OutlineService],
})
export class OutlineModule {}
