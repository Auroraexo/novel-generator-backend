import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../llm/llm.service';
import { PromptService } from '../prompt/prompt.service';
import { PrismaService } from '../prisma/prisma.service';

const OutlineItemSchema = z.object({
  index: z.number(),
  title: z.string(),
  scene: z.string(),
  characters: z.array(z.string()),
  goal: z.string(),
  conflict: z.string(),
  key_events: z.array(z.string()),
  emotional_beat: z.string(),
  payoff: z.string(),
  ending_hook: z.string(),
  foreshadowing: z.array(z.string()),
  callback: z.array(z.string()),
});

export type OutlineItem = z.infer<typeof OutlineItemSchema>;

const OUTLINE_BATCH_SIZE = 2;

@Injectable()
export class OutlineService {
  private readonly logger = new Logger(OutlineService.name);

  constructor(
    private llm: LlmService,
    private prompt: PromptService,
    private prisma: PrismaService,
  ) {}

  async generate(projectId: string): Promise<OutlineItem[]> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    if (!project.setting) {
      throw new Error('必须先生成项目设定');
    }

    const settingJson = JSON.stringify(project.setting, null, 2);
    const systemPrompt = this.prompt.getSystemPrompt();
    const outlines: OutlineItem[] = [];

    for (
      let start = 1;
      start <= project.targetChapters;
      start += OUTLINE_BATCH_SIZE
    ) {
      const end = Math.min(
        start + OUTLINE_BATCH_SIZE - 1,
        project.targetChapters,
      );
      const batchCount = end - start + 1;

      this.logger.log(`正在生成第 ${start}-${end} 章章纲...`);

      const batch = await this.generateBatchRange(
        systemPrompt,
        settingJson,
        project.targetChapters,
        start,
        end,
        outlines,
      );

      if (batch.length !== batchCount) {
        this.logger.warn(
          `第 ${start}-${end} 章期望 ${batchCount} 章，实际 ${batch.length} 章`,
        );
      }

      outlines.push(...batch);
    }

    if (outlines.length !== project.targetChapters) {
      this.logger.warn(
        `期望 ${project.targetChapters} 章，实际 ${outlines.length} 章`,
      );
    }

    await this.prisma.outline.deleteMany({ where: { projectId } });

    await this.prisma.outline.createMany({
      data: outlines.map((item) => ({
        projectId,
        index: item.index,
        title: item.title,
        data: item as any,
      })),
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'outline' },
    });

    this.logger.log(`项目 ${projectId} 的章纲已生成：${outlines.length} 章`);
    return outlines;
  }

  private async generateBatchRange(
    systemPrompt: string,
    settingJson: string,
    targetChapters: number,
    start: number,
    end: number,
    previousOutlines: OutlineItem[],
  ): Promise<OutlineItem[]> {
    const batchCount = end - start + 1;
    const userPrompt = this.prompt.buildOutlineBatchPrompt(
      settingJson,
      targetChapters,
      start,
      end,
      previousOutlines.length > 0
        ? JSON.stringify(previousOutlines, null, 2)
        : undefined,
    );

    try {
      return await this.llm.generateJson(
        systemPrompt,
        userPrompt,
        {
          temperature: 0.5,
          topP: 0.85,
          maxTokens: batchCount * 1800 + 800,
        },
        z.array(OutlineItemSchema),
      );
    } catch (err) {
      this.logger.warn(
        `第 ${start}-${end} 章批量生成失败，改为逐章生成：${(err as Error).message}`,
      );

      const items: OutlineItem[] = [];
      for (let index = start; index <= end; index++) {
        items.push(
          await this.generateSingleChapter(
            systemPrompt,
            settingJson,
            targetChapters,
            index,
            [...previousOutlines, ...items],
          ),
        );
      }
      return items;
    }
  }

  private async generateSingleChapter(
    systemPrompt: string,
    settingJson: string,
    targetChapters: number,
    index: number,
    previousOutlines: OutlineItem[],
  ): Promise<OutlineItem> {
    this.logger.log(`正在逐章生成第 ${index} 章章纲...`);

    const userPrompt = this.prompt.buildOutlineSinglePrompt(
      settingJson,
      targetChapters,
      index,
      previousOutlines.length > 0
        ? JSON.stringify(previousOutlines, null, 2)
        : undefined,
    );

    return this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.4, topP: 0.85, maxTokens: 1200 },
      OutlineItemSchema,
    );
  }

  async regenerateChapter(
    projectId: string,
    index: number,
    userFeedback: string,
  ): Promise<OutlineItem> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { outlines: { orderBy: { index: 'asc' } } },
    });

    const allOutlines = project.outlines.map((o) => o.data);
    const prevChapter = project.outlines.find((o) => o.index === index - 1);
    const nextChapter = project.outlines.find((o) => o.index === index + 1);

    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildOutlineRegeneratePrompt(
      JSON.stringify(project.setting, null, 2),
      JSON.stringify(allOutlines, null, 2),
      prevChapter ? JSON.stringify(prevChapter.data) : null,
      nextChapter ? JSON.stringify(nextChapter.data) : null,
      index,
      userFeedback,
    );

    const newOutline = await this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.8, topP: 0.9, maxTokens: 1000 },
      OutlineItemSchema,
    );

    await this.prisma.outline.update({
      where: { projectId_index: { projectId, index } },
      data: { title: newOutline.title, data: newOutline as any },
    });

    return newOutline;
  }

  async updateChapter(projectId: string, index: number, data: any) {
    return this.prisma.outline.update({
      where: { projectId_index: { projectId, index } },
      data: { title: data.title || undefined, data },
    });
  }
}
