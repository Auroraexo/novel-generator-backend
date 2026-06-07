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

const OutlineArraySchema = z.array(OutlineItemSchema);

export type OutlineItem = z.infer<typeof OutlineItemSchema>;

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
      throw new Error('Project setting must be generated first');
    }

    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildOutlinePrompt(
      JSON.stringify(project.setting, null, 2),
      project.targetChapters,
    );

    const outlines = await this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.8, topP: 0.9, maxTokens: 4000 },
      OutlineArraySchema,
    );

    if (outlines.length !== project.targetChapters) {
      this.logger.warn(
        `Expected ${project.targetChapters} chapters, got ${outlines.length}`,
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

    this.logger.log(`Outline generated for project ${projectId}: ${outlines.length} chapters`);
    return outlines;
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
