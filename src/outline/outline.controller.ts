import { Controller, Post, Put, Param, Body } from '@nestjs/common';
import { OutlineService } from './outline.service';

@Controller('projects/:projectId/outline')
export class OutlineController {
  constructor(private readonly outlineService: OutlineService) {}

  @Post('generate')
  generate(@Param('projectId') projectId: string) {
    return this.outlineService.generate(projectId);
  }

  @Post(':index/regenerate')
  regenerate(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
    @Body('feedback') feedback: string,
  ) {
    return this.outlineService.regenerateChapter(projectId, parseInt(index, 10), feedback);
  }

  @Put(':index')
  update(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
    @Body() data: any,
  ) {
    return this.outlineService.updateChapter(projectId, parseInt(index, 10), data);
  }
}
