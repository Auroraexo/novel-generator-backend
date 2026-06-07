import { Controller, Post, Param, Body } from '@nestjs/common';
import { ChapterService } from './chapter.service';

@Controller('projects/:projectId/chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Post(':index/generate')
  generate(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
  ) {
    return this.chapterService.generate(projectId, parseInt(index, 10));
  }

  @Post('generate-all')
  generateAll(@Param('projectId') projectId: string) {
    this.chapterService.generateAll(projectId);
    return { message: 'Generation started' };
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
