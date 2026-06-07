import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { PromptService, ChapterContext } from '../prompt/prompt.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { SummaryService } from '../summary/summary.service';

@Injectable()
export class ChapterService {
  private readonly logger = new Logger(ChapterService.name);

  constructor(
    private llm: LlmService,
    private prompt: PromptService,
    private prisma: PrismaService,
    private memory: MemoryService,
    private summary: SummaryService,
  ) {}

  async generate(projectId: string, index: number): Promise<string> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        outlines: { orderBy: { index: 'asc' } },
        chapters: { orderBy: { index: 'asc' } },
        memory: true,
      },
    });

    const currentOutline = project.outlines.find((o) => o.index === index);
    if (!currentOutline) {
      throw new Error(`Outline for chapter ${index} not found`);
    }

    const ctx = await this.buildContext(project, index);

    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildChapterPrompt(ctx);

    let content = await this.llm.generate(systemPrompt, userPrompt, {
      temperature: 0.85,
      topP: 0.92,
      maxTokens: 4000,
    });

    content = await this.adjustWordCount(content, project.targetWords);

    const wordCount = this.countWords(content);

    await this.prisma.chapter.upsert({
      where: { projectId_index: { projectId, index } },
      create: { projectId, index, content, wordCount },
      update: { content, wordCount, version: { increment: 1 } },
    });

    await this.summary.generateForChapter(projectId, index, content);

    this.logger.log(`Chapter ${index} generated: ${wordCount} words`);
    return content;
  }

  async generateAll(
    projectId: string,
    onProgress?: (index: number, total: number) => void,
  ): Promise<void> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { outlines: { orderBy: { index: 'asc' } } },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'writing' },
    });

    for (const outline of project.outlines) {
      await this.generate(projectId, outline.index);
      onProgress?.(outline.index, project.outlines.length);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'done' },
    });
  }

  async rewrite(
    projectId: string,
    index: number,
    feedback: string,
    keepElements: string,
  ): Promise<string> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        outlines: { orderBy: { index: 'asc' } },
        chapters: { orderBy: { index: 'asc' } },
        memory: true,
      },
    });

    const existingChapter = project.chapters.find((c) => c.index === index);
    if (!existingChapter) {
      throw new Error(`Chapter ${index} does not exist yet`);
    }

    const ctx = await this.buildContext(project, index);
    const systemPrompt = this.prompt.getSystemPrompt();
    const userPrompt = this.prompt.buildChapterRewritePrompt(
      ctx,
      existingChapter.content,
      feedback,
      keepElements,
    );

    let content = await this.llm.generate(systemPrompt, userPrompt, {
      temperature: 0.85,
      topP: 0.92,
      maxTokens: 4000,
    });

    content = await this.adjustWordCount(content, project.targetWords);
    const wordCount = this.countWords(content);

    await this.prisma.chapter.update({
      where: { projectId_index: { projectId, index } },
      data: { content, wordCount, version: { increment: 1 } },
    });

    await this.summary.generateForChapter(projectId, index, content);
    return content;
  }

  private async buildContext(project: any, index: number): Promise<ChapterContext> {
    const setting = project.setting as any;
    const outlines = project.outlines;
    const currentOutline = outlines.find((o: any) => o.index === index);
    const prevChapter = project.chapters.find((c: any) => c.index === index - 1);

    const settingCompact = JSON.stringify({
      title: setting.title,
      protagonist: setting.protagonist,
      antagonist: setting.antagonist,
      core_conflict: setting.core_conflict,
      tone: setting.tone,
    });

    const outlineSummary = outlines
      .map((o: any) => `第${o.index}章「${o.title}」`)
      .join('\n');

    const prevTail = prevChapter
      ? prevChapter.content.slice(-500)
      : '';

    const memoryData = project.memory;
    const cumulativeSummary = memoryData?.cumulativeSummary || '';
    const foreshadowing = memoryData?.foreshadowing || [];
    const pendingForeshadowing = (foreshadowing as any[])
      .filter((f: any) => !f.resolved)
      .map((f: any) => `- 第${f.chapter}章：${f.content}`)
      .join('\n');

    return {
      index,
      targetWords: project.targetWords,
      settingCompact,
      outlineSummary,
      currentOutline: JSON.stringify(currentOutline.data, null, 2),
      prevChapterTail: prevTail,
      cumulativeSummary,
      pendingForeshadowing,
      genre: project.genre,
    };
  }

  private async adjustWordCount(content: string, targetWords: number): Promise<string> {
    const wordCount = this.countWords(content);
    const lowerBound = targetWords * 0.85;
    const upperBound = targetWords * 1.15;

    if (wordCount < lowerBound) {
      this.logger.warn(`Chapter too short (${wordCount}/${targetWords}), expanding...`);
      const systemPrompt = this.prompt.getSystemPrompt();
      const userPrompt = this.prompt.buildExpandPrompt(content, targetWords);
      content = await this.llm.generate(systemPrompt, userPrompt, {
        temperature: 0.8,
        maxTokens: 4000,
      });
    } else if (wordCount > upperBound) {
      this.logger.warn(`Chapter too long (${wordCount}/${targetWords}), trimming...`);
      const systemPrompt = this.prompt.getSystemPrompt();
      const userPrompt = this.prompt.buildTrimPrompt(content, targetWords);
      content = await this.llm.generate(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 4000,
      });
    }

    return content;
  }

  private countWords(text: string): number {
    return text.replace(/\s/g, '').length;
  }
}
