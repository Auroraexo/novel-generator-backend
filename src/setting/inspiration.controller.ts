import { Controller, Post, Body } from '@nestjs/common';
import { SettingService } from './setting.service';

@Controller('inspiration')
export class InspirationController {
  constructor(private readonly settingService: SettingService) {}

  @Post('generate')
  generate(@Body() body: { genre: string; subgenre: string }) {
    return this.settingService.generateInspiration(body.genre, body.subgenre);
  }
}
