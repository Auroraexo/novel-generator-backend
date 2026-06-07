import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Subject } from 'rxjs';

export interface GenerationEvent {
  projectId: string;
  type: 'progress' | 'chapter-complete' | 'error' | 'done';
  data: any;
}

@Injectable()
export class GenerationService {
  private events = new Map<string, Subject<GenerationEvent>>();

  constructor(
    @InjectQueue('novel-generation') private queue: Queue,
  ) {}

  async startFullGeneration(projectId: string) {
    await this.queue.add('generate-full', { projectId });
    return { message: '生成任务已加入队列', projectId };
  }

  async startSettingGeneration(projectId: string) {
    await this.queue.add('generate-setting', { projectId });
    return { message: '设定生成已加入队列', projectId };
  }

  async startOutlineGeneration(projectId: string) {
    await this.queue.add('generate-outline', { projectId });
    return { message: '章纲生成已加入队列', projectId };
  }

  async startChapterGeneration(projectId: string, index: number) {
    await this.queue.add('generate-chapter', { projectId, index });
    return { message: `第 ${index} 章生成已加入队列`, projectId };
  }

  getEventStream(projectId: string): Subject<GenerationEvent> {
    if (!this.events.has(projectId)) {
      this.events.set(projectId, new Subject<GenerationEvent>());
    }
    return this.events.get(projectId)!;
  }

  emit(event: GenerationEvent) {
    const subject = this.events.get(event.projectId);
    if (subject) {
      subject.next(event);
    }
  }

  cleanup(projectId: string) {
    const subject = this.events.get(projectId);
    if (subject) {
      subject.complete();
      this.events.delete(projectId);
    }
  }
}
