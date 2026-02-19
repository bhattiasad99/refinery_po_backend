/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map as rxjsMap } from 'rxjs/operators';
import { APP_NAME, APP_VERSION } from './response.constants';

type SuccessPayload = {
  body?: unknown;
  message?: string;
};

type ApiResponse = {
  AppName: string;
  Version: string;
  status: number;
  error: boolean;
  body: unknown;
  message: string;
};

const map = rxjsMap as unknown as (
  project: (data: unknown) => ApiResponse,
) => any;

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): ReturnType<CallHandler['handle']> {
    const response = context.switchToHttp().getResponse();

    return (next.handle() as ReturnType<CallHandler['handle']>).pipe(
      map((data) => {
        const payload =
          data && typeof data === 'object'
            ? (data as SuccessPayload)
            : undefined;
        const body =
          payload && 'body' in payload ? payload.body : (data ?? null);
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
