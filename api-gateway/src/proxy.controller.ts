import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppService, PROXIED_SERVICE_NAMES } from './app.service';

const PROXY_CONTROLLER_PATHS = PROXIED_SERVICE_NAMES;

@Controller(PROXY_CONTROLLER_PATHS)
export class ProxyController {
  // eslint-disable-next-line prettier/prettier
  constructor(private readonly appService: AppService) { }

  @All(['', '/*path'])
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
