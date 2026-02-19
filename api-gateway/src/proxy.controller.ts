import { All, Controller, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppService, PROXIED_SERVICE_NAMES } from './app.service';

const PROXY_CONTROLLER_PATHS = PROXIED_SERVICE_NAMES;

@ApiTags('Proxy')
@Controller(PROXY_CONTROLLER_PATHS)
export class ProxyController {
  // eslint-disable-next-line prettier/prettier
  constructor(private readonly appService: AppService) { }

  @ApiOperation({
    summary: 'Proxy request to downstream services',
    description:
      'Catch-all proxy route for configured backend services. Use /{service}/{path}.',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Bearer access token for authenticated requests.',
  })
  @ApiBody({
    required: false,
    schema: {
      oneOf: [{ type: 'object', additionalProperties: true }, { type: 'array' }],
    },
  })
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
