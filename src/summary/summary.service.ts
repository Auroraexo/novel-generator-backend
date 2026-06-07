import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../llm/llm.service';
import { PromptService } from '../prompt/prompt.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';

const SummarySchema = z.object({
  index: z.number(),
  one_line_summary: z.string(),
  key_facts: z.array(z.string()),
  character_state_changes: z.array(
    z.object({ name: z.string(), change: z.string() }),
  ),
  new_foreshadowing: z.array(z.string()),
  resolved_foreshadowing: z.array(z.string()),
  world_state_delta: z.string().nullable(),
  emotional_residue: z.string(),
  next_chapter_setup: z.string(),
});

export type ChapterSummary = z.infer<typeof SummarySchema>;

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private llm: LlmService,
    private prompt: PromptService,
    private prisma: PrismaService,
    private memory: MemoryService,
  ) {}

  async generateForChapter(
    projectId: string,
    index: number,
    content: string,
  ): Promise<ChapterSummary> {
    const outline = await this.prisma.outline.findUnique({
      where: { projectId_index: { projectId, index } },
    });

    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildSummaryPrompt(
      content,
      JSON.stringify(outline?.data || {}),
      index,
    );

    const summary = await this.llm.generateJson(
      systemPrompt,
      userPrompt,
      { temperature: 0.3, topP: 0.8, maxTokens: 800 },
      SummarySchema,
    );

    await this.prisma.chapter.update({
      where: { projectId_index: { projectId, index } },
      data: { summary: summary as any },
    });

    for (const f of summary.new_foreshadowing) {
      await this.memory.addForeshadowing(projectId, f, index);
    }

    for (const f of summary.resolved_foreshadowing) {
      await this.memory.resolveForeshadowing(projectId, f);
    }

    for (const change of summary.character_state_changes) {
      await this.memory.updateCharacterState(projectId, change.name, change.change);
    }

    await this.updateCumulativeSummary(projectId, index);

    this.logger.log(`Summary generated for chapter ${index}`);
    return summary;
  }

  private async updateCumulativeSummary(projectId: string, currentIndex: number) {
    const allChapters = await this.prisma.chapter.findMany({
      where: { projectId },
      orderBy: { index: 'asc' },
    });
    const chapters = allChapters.filter((c) => c.summary !== null);

    if (currentIndex % 3 === 0 && currentIndex >= 3) {
      const recentThree = chapters.slice(-3);
      const threeSummaries = recentThree
        .map((c) => {
          const s = c.summary as any;
          return `第${c.index}章：${s.one_line_summary}`;
        })
        .join('\n');

      const systemPrompt = this.prompt.getSystemPrompt();
      const mergePrompt = this.prompt.buildMidMergePrompt(threeSummaries);
      const merged = await this.llm.generate(systemPrompt, mergePrompt, {
        temperature: 0.3,
        maxTokens: 400,
      });

      const memory = await this.memory.getOrCreate(projectId);
      const existing = memory.cumulativeSummary;
      const newSummary = existing ? `${existing}\n\n${merged}` : merged;
      await this.memory.updateCumulativeSummary(projectId, newSummary);
    } else {
      const lastChapter = chapters[chapters.length - 1];
      if (lastChapter?.summary) {
        const s = lastChapter.summary as any;
        const memory = await this.memory.getOrCreate(projectId);
        const existing = memory.cumulativeSummary;
        const append = `第${lastChapter.index}章：${s.one_line_summary}`;
        const newSummary = existing ? `${existing}\n${append}` : append;
        await this.memory.updateCumulativeSummary(projectId, newSummary);
      }
    }
  }
}
