import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SettingService } from '../setting/setting.service';
import { OutlineService } from '../outline/outline.service';
import { ChapterService } from '../chapter/chapter.service';
import { GenerationService } from './generation.service';

@Processor('novel-generation')
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private settingService: SettingService,
    private outlineService: OutlineService,
    private chapterService: ChapterService,
    private generationService: GenerationService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { projectId } = job.data;

    try {
      switch (job.name) {
        case 'generate-setting':
          return await this.handleSetting(projectId);
        case 'generate-outline':
          return await this.handleOutline(projectId);
        case 'generate-chapter':
          return await this.handleChapter(projectId, job.data.index);
        case 'generate-all-chapters':
          return await this.handleAllChapters(
            projectId,
            job.data.skipExisting ?? false,
          );
        case 'generate-full':
          return await this.handleFull(projectId);
        default:
          throw new Error(`未知的任务类型：${job.name}`);
      }
    } catch (error) {
      this.logger.error(`任务 ${job.name} 失败：${error.message}`);
      this.generationService.emit({
        projectId,
        type: 'error',
        data: { message: error.message, job: job.name },
      });
      throw error;
    }
  }

  private async handleSetting(projectId: string) {
    this.generationService.emit({
      projectId,
      type: 'progress',
      data: { stage: 'setting', message: '正在生成故事设定...' },
    });

    const setting = await this.settingService.generate(projectId);

    this.generationService.emit({
      projectId,
      type: 'progress',
      data: { stage: 'setting', message: '故事设定生成完成', setting },
    });

    return setting;
  }

  private async handleOutline(projectId: string) {
    this.generationService.emit({
      projectId,
      type: 'progress',
      data: { stage: 'outline', message: '正在生成章纲...' },
    });

    const outlines = await this.outlineService.generate(projectId);

    this.generationService.emit({
      projectId,
      type: 'progress',
      data: { stage: 'outline', message: '章纲生成完成', count: outlines.length },
    });

    return outlines;
  }

  private async handleChapter(projectId: string, index: number) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { outlines: true },
    });
    await prisma.$disconnect();

    this.generationService.emit({
      projectId,
      type: 'progress',
      data: {
        stage: 'chapter',
        message: `正在生成第 ${index} 章...`,
        index,
        total: project.outlines.length,
      },
    });

    const content = await this.chapterService.generate(projectId, index);
    const wordCount = content.replace(/\s/g, '').length;

    this.generationService.emit({
      projectId,
      type: 'chapter-complete',
      data: { index, total: project.outlines.length, wordCount },
    });

    this.generationService.emit({
      projectId,
      type: 'done',
      data: { message: `第 ${index} 章生成完成`, index },
    });

    return content;
  }

  private async handleAllChapters(projectId: string, skipExisting: boolean) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        outlines: { orderBy: { index: 'asc' } },
        chapters: true,
      },
    });
    await prisma.$disconnect();

    const existingIndexes = new Set(project.chapters.map((c) => c.index));
    const targets = skipExisting
      ? project.outlines.filter((o) => !existingIndexes.has(o.index))
      : project.outlines;

    if (targets.length === 0) {
      this.generationService.emit({
        projectId,
        type: 'done',
        data: { message: '没有需要生成的章节' },
      });
      return;
    }

    this.generationService.emit({
      projectId,
      type: 'progress',
      data: {
        stage: 'chapters',
        message: skipExisting
          ? `开始生成剩余 ${targets.length} 章...`
          : `开始生成全部 ${targets.length} 章...`,
        total: project.outlines.length,
        pending: targets.length,
      },
    });

    await this.chapterService.generateAll(
      projectId,
      { skipExisting },
      (index, total) => {
        this.generationService.emit({
          projectId,
          type: 'chapter-complete',
          data: { index, total },
        });
      },
    );

    this.generationService.emit({
      projectId,
      type: 'done',
      data: { message: '章节批量生成完成' },
    });
  }

  private async handleFull(projectId: string) {
    await this.handleSetting(projectId);
    await this.handleOutline(projectId);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { outlines: { orderBy: { index: 'asc' } } },
    });
    await prisma.$disconnect();

    for (const outline of project.outlines) {
      await this.handleChapter(projectId, outline.index);
    }

    this.generationService.emit({
      projectId,
      type: 'done',
      data: { message: '全部生成完成' },
    });
  }
}
