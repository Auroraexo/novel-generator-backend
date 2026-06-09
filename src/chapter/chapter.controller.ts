import { Controller, Post, Param, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChapterService } from './chapter.service';

@Controller('projects/:projectId/chapters')
export class ChapterController {
  constructor(
    private readonly chapterService: ChapterService,
    @InjectQueue('novel-generation') private readonly queue: Queue,
  ) {}

  @Post(':index/generate')
  async generate(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
  ) {
    const chapterIndex = parseInt(index, 10);
    await this.queue.add('generate-chapter', { projectId, index: chapterIndex });
    return { message: `第 ${chapterIndex} 章已加入生成队列`, index: chapterIndex };
  }

  @Post('generate-all')
  async generateAll(@Param('projectId') projectId: string) {
    await this.queue.add('generate-all-chapters', {
      projectId,
      skipExisting: false,
    });
    return { message: '全部章节生成任务已开始' };
  }

  @Post('generate-remaining')
  async generateRemaining(@Param('projectId') projectId: string) {
    await this.queue.add('generate-all-chapters', {
      projectId,
      skipExisting: true,
    });
    return { message: '剩余章节生成任务已开始' };
  }

  @Post(':index/rewrite')
  rewrite(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
    @Body() body: { feedback: string; keepElements: string },
  ) {
    return this.chapterService.rewrite(
      projectId,
      parseInt(index, 10),
      body.feedback,
      body.keepElements,
    );
  }
}
