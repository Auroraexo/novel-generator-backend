import { Controller, Post, Put, Param, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from './setting.service';

@Controller('projects/:projectId/setting')
export class SettingController {
  constructor(
    private readonly settingService: SettingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate')
  generate(@Param('projectId') projectId: string) {
    return this.settingService.generate(projectId);
  }

  @Put()
  update(@Param('projectId') projectId: string, @Body() setting: any) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { setting },
    });
  }
}
