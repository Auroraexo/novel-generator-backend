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
        case 'generate-full':
          return await this.handleFull(projectId);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.name} failed: ${error.message}`);
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
    this.generationService.emit({
      projectId,
      type: 'progress',
      data: { stage: 'chapter', message: `正在生成第 ${index} 章...`, index },
    });

    const content = await this.chapterService.generate(projectId, index);

    this.generationService.emit({
      projectId,
      type: 'chapter-complete',
      data: { index, wordCount: content.replace(/\s/g, '').length },
    });

    return content;
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
