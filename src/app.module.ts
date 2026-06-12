import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          connectTimeout: 30_000,
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) =>
            times > 20 ? null : Math.min(times * 500, 5_000),
        },
      }),
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
