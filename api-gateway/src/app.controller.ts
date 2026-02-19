import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
