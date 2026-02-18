import { All, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
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

  @All('*')
  async proxy(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const upstream = await this.appService.forward(request);
    response.status(upstream.status);
    return {
      body: upstream.body,
      message: upstream.message,
    };
  }
}
