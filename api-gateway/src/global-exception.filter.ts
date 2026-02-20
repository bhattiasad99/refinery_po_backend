import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { APP_NAME, APP_VERSION } from './response.constants';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: unknown = null;
    let message = 'Internal server error';
    let retryAfterSeconds: number | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const httpResponse = exception.getResponse();

      if (typeof httpResponse === 'string') {
        message = httpResponse;
      } else if (httpResponse && typeof httpResponse === 'object') {
        const parsed = httpResponse as {
          message?: unknown;
          body?: unknown;
          retryAfterSeconds?: unknown;
        };
        body = 'body' in parsed ? parsed.body : null;
        if (typeof parsed.retryAfterSeconds === 'number') {
          retryAfterSeconds = parsed.retryAfterSeconds;
        }

        if (Array.isArray(parsed.message)) {
          message = parsed.message.join(', ');
        } else if (typeof parsed.message === 'string') {
          message = parsed.message;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (retryAfterSeconds && status === HttpStatus.SERVICE_UNAVAILABLE) {
      response.setHeader('Retry-After', String(retryAfterSeconds));
    }

    response.status(status).json({
      AppName: APP_NAME,
      Version: APP_VERSION,
      status,
      error: true,
      body,
      message,
    });
  }
}
