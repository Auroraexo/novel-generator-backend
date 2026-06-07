import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        genre: dto.genre,
        subgenre: dto.subgenre,
        inspiration: dto.inspiration,
        targetChapters: dto.targetChapters ?? 12,
        targetWords: dto.targetWords ?? 2000,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        genre: true,
        subgenre: true,
        inspiration: true,
        targetChapters: true,
        status: true,
        setting: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        outlines: { orderBy: { index: 'asc' } },
        chapters: { orderBy: { index: 'asc' } },
        memory: true,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.project.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }
}
