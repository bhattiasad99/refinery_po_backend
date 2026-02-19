import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

type ServiceConfig = {
  serviceName: string;
  url: string;
};

type GatewayIncomingEvent = {
  id?: string;
  name: string;
  body: Record<string, unknown>;
  source: string;
  url: string;
  timestamp?: string;
};

export const SERVICES: ServiceConfig[] = [
  {
    serviceName: 'catalog',
    url: process.env.SERVICE_CATALOG_URL?.trim() as string,
  },
  {
    serviceName: 'purchase-orders',
    url: process.env.SERVICE_PURCHASE_ORDERS_URL?.trim() as string,
  },
  {
    serviceName: 'event-bus',
    url: process.env.SERVICE_EVENT_BUS_URL?.trim() as string,
  },
  {
    serviceName: 'departments',
    url: process.env.SERVICE_DEPARTMENTS_URL?.trim() as string,
  },
  {
    serviceName: 'users',
    url: process.env.SERVICE_USERS_URL?.trim() as string,
  },
];

export const PROXIED_SERVICE_NAMES = SERVICES.map(
  ({ serviceName }) => serviceName,
);

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'api-gateway' };
  }

  receiveEvent(payload: unknown): { accepted: true; eventName: string } {
    const eventPayload = this.validateEventPayload(payload);
    return {
      accepted: true,
      eventName: eventPayload.name,
    };
  }

  async forward(request: Request): Promise<{
    status: number;
    body: unknown;
    message: string;
  }> {
    const { serviceName, restPath } = this.parseIncomingPath(request.path);
    const serviceUrl = this.findServiceUrl(serviceName);
    const targetUrl = this.buildTargetUrl(
      serviceUrl,
      restPath,
      request.originalUrl,
    );

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: this.getForwardHeaders(request),
        body: this.getRequestBody(request),
        redirect: 'manual',
      });
    } catch {
      throw new BadGatewayException({
        message: `Unable to reach service '${serviceName}'`,
        body: null,
      });
    }

    const parsedBody = await this.parseResponseBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      throw new HttpException(
        {
          message:
            this.extractMessage(parsedBody) ||
            `Service '${serviceName}' failed`,
          body: parsedBody,
        },
        upstreamResponse.status,
      );
    }

    return {
      status: upstreamResponse.status,
      body: parsedBody,
      message: 'Success',
    };
  }

  private parseIncomingPath(pathname: string) {
    const normalized = pathname.replace(/^\/+/, '');
    if (!normalized) {
      throw new NotFoundException(
        'Missing service route prefix. Use /{service}/...',
      );
    }

    const [serviceName, ...restParts] = normalized.split('/');
    if (!serviceName || serviceName === 'health') {
      throw new NotFoundException('Route not found');
    }

    return {
      serviceName,
      restPath: restParts.length > 0 ? `/${restParts.join('/')}` : '/',
    };
  }

  private findServiceUrl(serviceName: string): string {
    const service = SERVICES.find((entry) => entry.serviceName === serviceName);
    if (!service) {
      throw new NotFoundException(
        `Unknown service '${serviceName}'. Update SERVICES in api-gateway/src/app.service.ts`,
      );
    }

    if (service.serviceName === 'api-gateway') {
      throw new NotFoundException('Refusing to proxy api-gateway to itself');
    }

    return service.url;
  }

  private buildTargetUrl(
    baseUrl: string,
    restPath: string,
    originalUrl: string,
  ): string {
    const queryIndex = originalUrl.indexOf('?');
    const queryString = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
    return `${baseUrl}${restPath}${queryString}`;
  }

  private getForwardHeaders(request: Request): Record<string, string> {
    const excluded = new Set([
      'host',
      'connection',
      'content-length',
      'x-internal-key',
    ]);
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(request.headers)) {
      if (!value || excluded.has(name.toLowerCase())) {
        continue;
      }
      headers[name] = Array.isArray(value) ? value.join(',') : value;
    }

    const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();
    if (internalKey) {
      headers['x-internal-key'] = internalKey;
    }

    return headers;
  }

  private getRequestBody(request: Request): string | undefined {
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    if (request.body === undefined || request.body === null) {
      return undefined;
    }

    if (typeof request.body === 'string') {
      return request.body;
    }

    return JSON.stringify(request.body);
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    const text = await response.text();
    return text.length > 0 ? text : null;
  }

  private extractMessage(body: unknown): string | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return null;
  }

  private validateEventPayload(payload: unknown): GatewayIncomingEvent {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('event payload must be a JSON object');
    }

    const eventPayload = payload as Partial<GatewayIncomingEvent>;

    if (
      typeof eventPayload.name !== 'string' ||
      eventPayload.name.trim().length === 0
    ) {
      throw new BadRequestException('name is required');
    }

    if (
      !eventPayload.body ||
      typeof eventPayload.body !== 'object' ||
      Array.isArray(eventPayload.body)
    ) {
      throw new BadRequestException('body must be a JSON object');
    }

    if (
      typeof eventPayload.source !== 'string' ||
      eventPayload.source.trim().length === 0
    ) {
      throw new BadRequestException('source is required');
    }

    if (
      typeof eventPayload.url !== 'string' ||
      eventPayload.url.trim().length === 0
    ) {
      throw new BadRequestException('url is required');
    }

    return {
      id: typeof eventPayload.id === 'string' ? eventPayload.id : undefined,
      name: eventPayload.name.trim(),
      body: eventPayload.body,
      source: eventPayload.source.trim(),
      url: eventPayload.url.trim(),
      timestamp:
        typeof eventPayload.timestamp === 'string'
          ? eventPayload.timestamp
          : undefined,
    };
  }
}
