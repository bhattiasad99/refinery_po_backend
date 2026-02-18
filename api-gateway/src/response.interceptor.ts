import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { APP_NAME, APP_VERSION } from './response.constants';

const { map } = require('rxjs');

type SuccessPayload = {
  body?: unknown;
  message?: string;
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): ReturnType<CallHandler['handle']> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data: SuccessPayload | unknown) => {
        const payload =
          data && typeof data === 'object' ? (data as SuccessPayload) : undefined;
        const body = payload && 'body' in payload ? payload.body : data ?? null;
        const message =
          payload && typeof payload.message === 'string'
            ? payload.message
            : 'Success';

        return {
          AppName: APP_NAME,
          Version: APP_VERSION,
          status: response.statusCode,
          error: false,
          body,
          message,
        };
      }),
    );
  }
}
