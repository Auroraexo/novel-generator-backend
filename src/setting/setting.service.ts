import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../llm/llm.service';
import { PromptService } from '../prompt/prompt.service';
import { PrismaService } from '../prisma/prisma.service';

const SettingSchema = z.object({
  title: z.string(),
  logline: z.string(),
  tone: z.string(),
  protagonist: z.object({
    name: z.string(),
    age: z.number(),
    identity: z.string(),
    personality: z.string(),
    motivation: z.string(),
    flaw: z.string(),
  }),
  antagonist: z.object({
    name: z.string(),
    identity: z.string(),
    goal: z.string(),
    relationship: z.string(),
  }),
  supporting_cast: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      function: z.string(),
    }),
  ),
  world_setting: z.object({
    time_space: z.string(),
    key_rules: z.array(z.string()),
    key_locations: z.array(z.string()),
  }),
  core_conflict: z.string(),
  secondary_conflicts: z.array(z.string()),
  story_arc: z.object({
    opening_hook: z.string(),
    midpoint_twist: z.string(),
    climax: z.string(),
    resolution: z.string(),
  }),
  selling_points: z.array(z.string()),
});

export type SettingData = z.infer<typeof SettingSchema>;

@Injectable()
export class SettingService {
  private readonly logger = new Logger(SettingService.name);

  constructor(
    private llm: LlmService,
    private prompt: PromptService,
    private prisma: PrismaService,
  ) {}

  async generateInspiration(genre: string, subgenre: string): Promise<string[]> {
    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = `【任务】
基于以下题材，生成 5 条"一句话故事灵感"。

【题材】${genre} - ${subgenre}

【要求】
1. 每条灵感 20-40 字
2. 必须包含核心冲突或反转
3. 要有画面感和钩子感，让人一看就想知道后续
4. 5 条之间风格差异要大，覆盖不同方向
5. 避免俗套开头（"一个普通的…"）

【输出格式】严格输出 JSON 数组，每个元素为一条灵感字符串，不加任何解释：
["灵感1", "灵感2", "灵感3", "灵感4", "灵感5"]`;

    const schema = z.array(z.string()).min(3).max(10);

    return this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.95, topP: 0.95, maxTokens: 800 },
      schema,
    );
  }

  async generate(projectId: string): Promise<SettingData> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildSettingPrompt({
      genre: project.genre,
      subgenre: project.subgenre,
      inspiration: project.inspiration,
      targetChapters: project.targetChapters,
      targetWords: project.targetWords,
    });

    const setting = await this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.9, topP: 0.95, maxTokens: 2000 },
      SettingSchema,
    );

    await this.prisma.project.update({
      where: { id: projectId },
      data: { setting: setting as any, status: 'setting' },
    });

    this.logger.log(`Setting generated for project ${projectId}: ${setting.title}`);
    return setting;
  }
}
