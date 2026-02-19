import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
