import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Foreshadowing {
  content: string;
  chapter: number;
  resolved: boolean;
}

@Injectable()
export class MemoryService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(projectId: string) {
    return this.prisma.memory.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
    });
  }

  async updateCumulativeSummary(projectId: string, summary: string) {
    await this.prisma.memory.upsert({
      where: { projectId },
      create: { projectId, cumulativeSummary: summary },
      update: { cumulativeSummary: summary },
    });
  }

  async addForeshadowing(projectId: string, content: string, chapter: number) {
    const memory = await this.getOrCreate(projectId);
    const items = memory.foreshadowing as unknown as Foreshadowing[];
    items.push({ content, chapter, resolved: false });
    await this.prisma.memory.update({
      where: { projectId },
      data: { foreshadowing: items as any },
    });
  }

  async resolveForeshadowing(projectId: string, content: string) {
    const memory = await this.getOrCreate(projectId);
    const items = memory.foreshadowing as unknown as Foreshadowing[];
    const item = items.find((f) => f.content === content && !f.resolved);
    if (item) {
      item.resolved = true;
      await this.prisma.memory.update({
        where: { projectId },
        data: { foreshadowing: items as any },
      });
    }
  }

  async updateCharacterState(projectId: string, name: string, state: string) {
    const memory = await this.getOrCreate(projectId);
    const states = memory.characterStates as Record<string, string>;
    states[name] = state;
    await this.prisma.memory.update({
      where: { projectId },
      data: { characterStates: states },
    });
  }

  async getPendingForeshadowing(projectId: string): Promise<Foreshadowing[]> {
    const memory = await this.getOrCreate(projectId);
    const items = memory.foreshadowing as unknown as Foreshadowing[];
    return items.filter((f) => !f.resolved);
  }
}
