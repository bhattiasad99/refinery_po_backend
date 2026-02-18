import {
  BadGatewayException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request } from 'express';

type LocalService = {
  name: string;
  localUrl: string;
};

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', service: 'api-gateway' };
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
    const serviceUrlFromEnv = this.getServiceUrlFromEnv(serviceName);
    if (serviceUrlFromEnv) {
      return serviceUrlFromEnv;
    }

    const services = this.readServices();
    const service = services.find((entry) => entry.name === serviceName);
    if (!service) {
      throw new NotFoundException(
        `Unknown service '${serviceName}'. Set ${this.toServiceEnvKey(serviceName)} or update services.local.json`,
      );
    }
    if (service.name === 'api-gateway') {
      throw new NotFoundException('Refusing to proxy api-gateway to itself');
    }

    return service.localUrl;
  }

  private readServices(): LocalService[] {
    const filePath =
      process.env.LOCAL_SERVICES_FILE ??
      path.join(process.cwd(), 'services.local.json');
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { services?: LocalService[] };
    return Array.isArray(parsed.services) ? parsed.services : [];
  }

  private getServiceUrlFromEnv(serviceName: string): string | null {
    const key = this.toServiceEnvKey(serviceName);
    const value = process.env[key]?.trim();
    return value && value.length > 0 ? value : null;
  }

  private toServiceEnvKey(serviceName: string): string {
    const normalized = serviceName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    return `SERVICE_${normalized}_URL`;
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
}
