import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

type UpstreamErrorBody = {
  message?: unknown;
  body?: unknown;
};

@Injectable()
export class AuthService {
  async login(credentials: LoginDto): Promise<unknown> {
    const usersServiceUrl = process.env.SERVICE_USERS_URL?.trim();
    if (!usersServiceUrl) {
      throw new InternalServerErrorException(
        'SERVICE_USERS_URL is not configured',
      );
    }

    const targetUrl = `${usersServiceUrl.replace(/\/+$/, '')}/verify-credentials`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();
    if (internalKey) {
      headers['x-internal-key'] = internalKey;
    }

    let upstream: Response;
    try {
      upstream = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(credentials),
      });
    } catch {
      throw new BadGatewayException({
        message: "Unable to reach service 'users'",
        body: null,
      });
    }

    const parsedBody = await this.parseResponseBody(upstream);
    if (!upstream.ok) {
      const responseBody = parsedBody as UpstreamErrorBody | null;
      throw new HttpException(
        {
          message: this.extractMessage(responseBody) ?? 'Login failed',
          body: responseBody?.body ?? parsedBody ?? null,
        },
        upstream.status,
      );
    }

    return parsedBody;
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

  private extractMessage(body: UpstreamErrorBody | null): string | null {
    if (!body) {
      return null;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }

    return null;
  }
}
