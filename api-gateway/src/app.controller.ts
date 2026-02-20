import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppService } from './app.service';

@ApiTags('Gateway')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Gateway health check' })
  @ApiOkResponse({
    description: 'Gateway healthy',
  })
  @Get('health')
  getHealth() {
    return {
      body: this.appService.getHealth(),
      message: 'Gateway healthy',
    };
  }

  @ApiOperation({ summary: 'Start warm-up across downstream services' })
  @ApiOkResponse({ description: 'Warm-up session started' })
  @Get('warm-up')
  startWarmUp() {
    const session = this.appService.startWarmUp();
    return {
      body: session,
      message: 'Warm-up session started',
    };
  }

  @ApiOperation({ summary: 'Get warm-up status by session id' })
  @ApiParam({
    name: 'id',
    description: 'Warm-up session id returned from GET /warm-up',
  })
  @ApiOkResponse({ description: 'Warm-up status snapshot' })
  @Get('warm-up/status/:id')
  getWarmUpStatus(@Param('id') id: string) {
    const job = this.appService.getWarmUpJob(id);
    return {
      body: job,
      message: 'Warm-up status',
    };
  }

  @ApiOperation({ summary: 'Stream live warm-up updates as Server-Sent Events' })
  @ApiParam({
    name: 'id',
    description: 'Warm-up session id returned from GET /warm-up',
  })
  @Get('warm-up/stream/:id')
  streamWarmUp(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const job = this.appService.getWarmUpJob(id);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    response.write(`event: snapshot\n`);
    response.write(`data: ${JSON.stringify(job)}\n\n`);

    const unsubscribe = this.appService.subscribeToWarmUp(
      id,
      (update) => {
        response.write(`event: update\n`);
        response.write(`data: ${JSON.stringify(update)}\n\n`);
      },
      (completedJob) => {
        response.write(`event: done\n`);
        response.write(`data: ${JSON.stringify(completedJob)}\n\n`);
        response.end();
      },
    );

    request.on('close', () => {
      unsubscribe();
      if (!response.writableEnded) {
        response.end();
      }
    });
  }

  @ApiOperation({ summary: 'List all API documentation endpoints' })
  @ApiOkResponse({
    description: 'Gateway + service docs and raw OpenAPI links',
  })
  @Get('api-specifications')
  getApiSpecifications(@Req() request: Request) {
    const protocol = request.header('x-forwarded-proto') ?? request.protocol;
    const host = request.get('host') ?? 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    return {
      body: {
        gateway: {
          docs: `${baseUrl}/docs`,
          openApiJson: `${baseUrl}/openapi.json`,
        },
        services: {
          users: {
            docs: `${baseUrl}/users/docs`,
            openApiJson: `${baseUrl}/users/openapi.json`,
          },
          catalog: {
            docs: `${baseUrl}/catalog/docs`,
            openApiJson: `${baseUrl}/catalog/openapi.json`,
          },
          departments: {
            docs: `${baseUrl}/departments/docs`,
            openApiJson: `${baseUrl}/departments/openapi.json`,
          },
          'purchase-orders': {
            docs: `${baseUrl}/purchase-orders/docs`,
            openApiJson: `${baseUrl}/purchase-orders/openapi.json`,
          },
        },
      },
      message: 'API specification endpoints',
    };
  }

  @ApiOperation({ summary: 'Receive gateway-level event payload' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        body: { type: 'object', additionalProperties: true },
        source: { type: 'string' },
        url: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['name', 'body', 'source', 'url'],
    },
  })
  @ApiOkResponse({ description: 'Event received' })
  @Post('events')
  handleEvent(@Body() payload: unknown) {
    return {
      body: this.appService.receiveEvent(payload),
      message: 'Event received',
    };
  }

  @ApiOperation({ summary: 'Run global bulk workflow' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        catalogItems: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        runUserBackfill: { type: 'boolean', default: true },
      },
      required: ['catalogItems'],
    },
  })
  @ApiOkResponse({
    description: 'Global bulk completed (success or partial failure)',
  })
  @ApiUnauthorizedResponse({
    description: 'Authenticated user context is required',
  })
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
