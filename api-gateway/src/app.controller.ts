import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return {
      body: this.appService.getHealth(),
      message: 'Gateway healthy',
    };
  }

  @Post('events')
  handleEvent(@Body() payload: unknown) {
    return {
      body: this.appService.receiveEvent(payload),
      message: 'Event received',
    };
  }

  @Post('global/bulk')
  async runGlobalBulk(@Req() request: Request, @Body() payload: unknown) {
    const result = await this.appService.runGlobalBulk(request, payload);
    return {
      body: result,
      message: result.ok
        ? 'Global bulk completed successfully'
        : 'Global bulk completed with failures',
    };
  }
}
