import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { LlmModule } from './llm/llm.module';
import { PromptModule } from './prompt/prompt.module';
import { ProjectModule } from './project/project.module';
import { SettingModule } from './setting/setting.module';
import { OutlineModule } from './outline/outline.module';
import { ChapterModule } from './chapter/chapter.module';
import { SummaryModule } from './summary/summary.module';
import { MemoryModule } from './memory/memory.module';
import { GenerationModule } from './generation/generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '107.173.156.235',
        port: parseInt(process.env.REDIS_PORT || '16379', 10),
      },
    }),
    PrismaModule,
    LlmModule,
    PromptModule,
    ProjectModule,
    SettingModule,
    OutlineModule,
    ChapterModule,
    SummaryModule,
    MemoryModule,
    GenerationModule,
  ],
})
export class AppModule {}
