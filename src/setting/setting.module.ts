import { Module } from '@nestjs/common';
import { SettingService } from './setting.service';
import { SettingController } from './setting.controller';
import { InspirationController } from './inspiration.controller';
import { LlmModule } from '../llm/llm.module';
import { PromptModule } from '../prompt/prompt.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [LlmModule, PromptModule, ProjectModule],
  controllers: [SettingController, InspirationController],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
