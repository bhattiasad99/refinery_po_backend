import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
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

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
    departmentId: string;
  };
};

type GlobalBulkRequest = {
  catalogItems: unknown[];
  runUserBackfill: boolean;
};

type GlobalBulkStepResult = {
  step: 'catalog_bulk' | 'users_backfill_create_users';
  ok: boolean;
  status: number;
  body: unknown;
  message: string;
};

type WarmUpServiceStatus = 'pending' | 'warming' | 'ready' | 'failed' | 'skipped';
type WarmUpJobStatus = 'running' | 'completed';

type WarmUpServiceResult = {
  serviceName: string;
  target: string | null;
  status: WarmUpServiceStatus;
  httpStatus: number | null;
  durationMs: number | null;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
};

type WarmUpJob = {
  id: string;
  status: WarmUpJobStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  services: WarmUpServiceResult[];
};

type WarmUpServiceUpdate = {
  jobId: string;
  jobStatus: WarmUpJobStatus;
  service: WarmUpServiceResult;
  updatedAt: string;
  completedAt: string | null;
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

const WARM_UP_HEALTH_PATH = '/health';
const WARM_UP_TIMEOUT_MS = 20000;
const WARM_UP_JOB_RETENTION_MS = 15 * 60 * 1000;
const WARM_UP_UPDATE_EVENT = 'warm-up-update';
const WARM_UP_DONE_EVENT = 'warm-up-done';

@Injectable()
export class AppService {
  private readonly warmUpJobs = new Map<string, WarmUpJob>();
  private readonly warmUpEvents = new EventEmitter();

  getHealth() {
    return { status: 'ok', service: 'api-gateway' };
  }

  startWarmUp(): {
    id: string;
    status: WarmUpJobStatus;
    createdAt: string;
    statusUrl: string;
    streamUrl: string;
  } {
    this.cleanupWarmUpJobs();

    const now = new Date().toISOString();
    const id = randomUUID();
    const services: WarmUpServiceResult[] = [
      {
        serviceName: 'api-gateway',
        target: '/health',
        status: 'ready',
        httpStatus: 200,
        durationMs: 0,
        message: 'Gateway is active',
        startedAt: now,
        completedAt: now,
      },
      ...SERVICES.map((service): WarmUpServiceResult => ({
        serviceName: service.serviceName,
        target: this.resolveHealthUrl(service.url),
        status: service.url ? 'pending' : 'skipped',
        httpStatus: null,
        durationMs: null,
        message: service.url ? 'Queued for warm-up' : 'Service URL is not configured',
        startedAt: null,
        completedAt: null,
      })),
    ];

    const job: WarmUpJob = {
      id,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      services,
    };

    this.warmUpJobs.set(id, job);
    void this.runWarmUp(id);

    return {
      id,
      status: job.status,
      createdAt: job.createdAt,
      statusUrl: `/warm-up/status/${id}`,
      streamUrl: `/warm-up/stream/${id}`,
    };
  }

  getWarmUpJob(jobId: string): WarmUpJob {
    this.cleanupWarmUpJobs();
    const job = this.warmUpJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Warm-up session '${jobId}' was not found`);
    }

    return {
      ...job,
      services: job.services.map((service) => ({ ...service })),
    };
  }

  subscribeToWarmUp(
    jobId: string,
    onUpdate: (update: WarmUpServiceUpdate) => void,
    onDone: (job: WarmUpJob) => void,
  ): () => void {
    const updateEventName = `${WARM_UP_UPDATE_EVENT}:${jobId}`;
    const doneEventName = `${WARM_UP_DONE_EVENT}:${jobId}`;

    const updateHandler = (update: WarmUpServiceUpdate) => onUpdate(update);
    const doneHandler = (job: WarmUpJob) => onDone(job);

    this.warmUpEvents.on(updateEventName, updateHandler);
    this.warmUpEvents.on(doneEventName, doneHandler);

    return () => {
      this.warmUpEvents.off(updateEventName, updateHandler);
      this.warmUpEvents.off(doneEventName, doneHandler);
    };
  }

  receiveEvent(payload: unknown): { accepted: true; eventName: string } {
    const eventPayload = this.validateEventPayload(payload);
    return {
      accepted: true,
      eventName: eventPayload.name,
    };
  }

  async runGlobalBulk(
    request: Request,
    payload: unknown,
  ): Promise<{
    ok: boolean;
    steps: GlobalBulkStepResult[];
  }> {
    const parsed = this.parseGlobalBulkRequest(payload);
    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user?.sub) {
      throw new UnauthorizedException('Authenticated user context is required');
    }

    const headers = this.getForwardHeaders(request);
    const steps: GlobalBulkStepResult[] = [];

    steps.push(
      await this.runBulkStep(
        'catalog_bulk',
        this.findServiceUrl('catalog'),
        '/bulk',
        headers,
        parsed.catalogItems,
      ),
    );

    if (parsed.runUserBackfill) {
      steps.push(
        await this.runBulkStep(
          'users_backfill_create_users',
          this.findServiceUrl('users'),
          '/back-fill/create_users',
          headers,
          undefined,
        ),
      );
    }

    return {
      ok: steps.every((step) => step.ok),
      steps,
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
      throw new ServiceUnavailableException({
        message: `Service '${serviceName}' is temporarily unavailable. Please retry shortly.`,
        body: null,
        retryAfterSeconds: 2,
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

  private async runWarmUp(jobId: string): Promise<void> {
    const job = this.warmUpJobs.get(jobId);
    if (!job) {
      return;
    }

    const tasks = job.services.map((service) => this.warmUpService(jobId, service.serviceName));
    await Promise.allSettled(tasks);

    const completedAt = new Date().toISOString();
    const latest = this.warmUpJobs.get(jobId);
    if (!latest) {
      return;
    }

    latest.status = 'completed';
    latest.updatedAt = completedAt;
    latest.completedAt = completedAt;
    this.warmUpEvents.emit(`${WARM_UP_DONE_EVENT}:${jobId}`, {
      ...latest,
      services: latest.services.map((service) => ({ ...service })),
    } as WarmUpJob);
  }

  private async warmUpService(jobId: string, serviceName: string): Promise<void> {
    const job = this.warmUpJobs.get(jobId);
    if (!job) {
      return;
    }

    const service = job.services.find((entry) => entry.serviceName === serviceName);
    if (!service || service.status === 'skipped' || service.status === 'ready') {
      return;
    }

    const startedAt = new Date().toISOString();
    service.status = 'warming';
    service.startedAt = startedAt;
    service.message = 'Warming service';
    this.emitWarmUpServiceUpdate(jobId, service);

    const target = service.target;
    if (!target) {
      service.status = 'skipped';
      service.message = 'Service URL is not configured';
      service.completedAt = new Date().toISOString();
      this.emitWarmUpServiceUpdate(jobId, service);
      return;
    }

    const startedTimestamp = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WARM_UP_TIMEOUT_MS);

    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: this.getInternalHeaders(),
        signal: controller.signal,
      });
      const completedAt = new Date().toISOString();

      service.durationMs = Date.now() - startedTimestamp;
      service.httpStatus = response.status;
      service.completedAt = completedAt;
      service.status = response.ok ? 'ready' : 'failed';
      service.message = response.ok
        ? 'Warm-up successful'
        : `Warm-up failed with status ${response.status}`;
      this.emitWarmUpServiceUpdate(jobId, service);
    } catch {
      const completedAt = new Date().toISOString();
      service.durationMs = Date.now() - startedTimestamp;
      service.httpStatus = null;
      service.completedAt = completedAt;
      service.status = 'failed';
      service.message = `Warm-up request timed out or failed after ${WARM_UP_TIMEOUT_MS}ms`;
      this.emitWarmUpServiceUpdate(jobId, service);
    } finally {
      clearTimeout(timeout);
    }
  }

  private emitWarmUpServiceUpdate(jobId: string, service: WarmUpServiceResult): void {
    const job = this.warmUpJobs.get(jobId);
    if (!job) {
      return;
    }

    job.updatedAt = new Date().toISOString();
    this.warmUpEvents.emit(`${WARM_UP_UPDATE_EVENT}:${jobId}`, {
      jobId,
      jobStatus: job.status,
      service: { ...service },
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    } as WarmUpServiceUpdate);
  }

  private resolveHealthUrl(baseUrl: string): string | null {
    if (!baseUrl) {
      return null;
    }

    return `${baseUrl.replace(/\/+$/, '')}${WARM_UP_HEALTH_PATH}`;
  }

  private getInternalHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();
    if (internalKey) {
      headers['x-internal-key'] = internalKey;
    }

    return headers;
  }

  private cleanupWarmUpJobs(): void {
    const now = Date.now();
    for (const [id, job] of this.warmUpJobs.entries()) {
      const completedAt = job.completedAt ? Date.parse(job.completedAt) : NaN;
      const createdAt = Date.parse(job.createdAt);
      const referenceTime = Number.isNaN(completedAt) ? createdAt : completedAt;
      if (now - referenceTime > WARM_UP_JOB_RETENTION_MS) {
        this.warmUpJobs.delete(id);
      }
    }
  }

  private parseGlobalBulkRequest(payload: unknown): GlobalBulkRequest {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('global bulk payload must be a JSON object');
    }

    const input = payload as { catalogItems?: unknown; runUserBackfill?: unknown };
    if (!Array.isArray(input.catalogItems)) {
      throw new BadRequestException('catalogItems must be an array');
    }

    if (
      input.runUserBackfill !== undefined &&
      typeof input.runUserBackfill !== 'boolean'
    ) {
      throw new BadRequestException('runUserBackfill must be a boolean when provided');
    }

    return {
      catalogItems: input.catalogItems,
      runUserBackfill: input.runUserBackfill ?? true,
    };
  }

  private async runBulkStep(
    step: GlobalBulkStepResult['step'],
    serviceUrl: string,
    path: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<GlobalBulkStepResult> {
    const targetUrl = this.buildTargetUrl(serviceUrl, path, path);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
    } catch {
      return {
        step,
        ok: false,
        status: 503,
        body: null,
        message: `Service for step '${step}' is temporarily unavailable. Please retry shortly.`,
      };
    }

    const parsedBody = await this.parseResponseBody(upstreamResponse);
    return {
      step,
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      body: parsedBody,
      message:
        this.extractMessage(parsedBody) ??
        (upstreamResponse.ok ? 'Success' : `Step '${step}' failed`),
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
    const authRequest = request as AuthenticatedRequest;
    const excluded = new Set([
      'host',
      'connection',
      'content-length',
      'x-internal-key',
      'authorization',
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

    if (authRequest.user) {
      headers['x-user-id'] = authRequest.user.sub;
      headers['x-user-email'] = authRequest.user.email;
      headers['x-user-department-id'] = authRequest.user.departmentId;
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
