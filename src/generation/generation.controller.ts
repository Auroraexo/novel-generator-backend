import { Controller, Sse, Param, Post, Body } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenerationService } from './generation.service';

@Controller('projects/:projectId/generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('setting')
  startSetting(@Param('projectId') projectId: string) {
    return this.generationService.startSettingGeneration(projectId);
  }

  @Post('outline')
  startOutline(@Param('projectId') projectId: string) {
    return this.generationService.startOutlineGeneration(projectId);
  }

  @Post('chapter/:index')
  startChapter(
    @Param('projectId') projectId: string,
    @Param('index') index: string,
  ) {
    return this.generationService.startChapterGeneration(
      projectId,
      parseInt(index, 10),
    );
  }

  @Post('full')
  startFull(@Param('projectId') projectId: string) {
    return this.generationService.startFullGeneration(projectId);
  }

  @Sse('events')
  events(@Param('projectId') projectId: string): Observable<MessageEvent> {
    const subject = this.generationService.getEventStream(projectId);

    return subject.pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
      } as unknown as MessageEvent)),
    );
  }
}
