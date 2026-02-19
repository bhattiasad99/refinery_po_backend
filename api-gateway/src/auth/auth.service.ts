import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { LoginDto } from './dto/login.dto';

type UpstreamErrorBody = {
  message?: unknown;
  body?: unknown;
};

type PublicUser = {
  id: string;
  email: string;
  departmentId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoginVerifyResponse = {
  authenticated: boolean;
  user: PublicUser;
};

type RotateResponse = {
  user: PublicUser;
  sessionId: string;
};

export type AccessTokenClaims = {
  sub: string;
  email: string;
  departmentId: string;
};

type LoginResult = {
  accessToken: string;
  user: PublicUser;
  refreshToken: string;
};

type RefreshResult = LoginResult;

@Injectable()
export class AuthService {
  async login(credentials: LoginDto): Promise<LoginResult> {
    const verifyResponse = await this.callUsers<LoginVerifyResponse>(
      '/verify-credentials',
      credentials,
      'Login failed',
    );

    if (!verifyResponse.authenticated || !verifyResponse.user?.id) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = this.getRefreshExpiresAt();

    await this.callUsers<{ sessionId: string }>(
      '/auth/sessions',
      {
        userId: verifyResponse.user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt.toISOString(),
      },
      'Failed to create session',
      'POST',
      201,
    );

    return {
      accessToken: this.signAccessToken(verifyResponse.user),
      user: verifyResponse.user,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const currentTokenHash = this.hashToken(refreshToken);
    const nextRefreshToken = this.generateRefreshToken();
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);
    const refreshExpiresAt = this.getRefreshExpiresAt();

    const rotateResponse = await this.callUsers<RotateResponse>(
      '/auth/sessions/rotate',
      {
        tokenHash: currentTokenHash,
        newTokenHash: nextRefreshTokenHash,
        expiresAt: refreshExpiresAt.toISOString(),
      },
      'Refresh failed',
    );

    return {
      accessToken: this.signAccessToken(rotateResponse.user),
      user: rotateResponse.user,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | null): Promise<{ loggedOut: true }> {
    if (!refreshToken) {
      return { loggedOut: true };
    }

    await this.callUsers<{ revoked: boolean }>(
      '/auth/sessions/revoke',
      { tokenHash: this.hashToken(refreshToken) },
      'Logout failed',
    );

    return { loggedOut: true };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, this.getAccessSecret()) as jwt.JwtPayload;
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const email = typeof payload.email === 'string' ? payload.email : '';
      const departmentId =
        typeof payload.departmentId === 'string' ? payload.departmentId : '';

      if (!sub || !email || !departmentId) {
        throw new UnauthorizedException('Invalid access token payload');
      }

      return { sub, email, departmentId };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  getRefreshCookieName(): string {
    return process.env.AUTH_COOKIE_NAME?.trim() || 'rt';
  }

  getRefreshCookieMaxAgeMs(): number {
    return this.getRefreshTtlDays() * 24 * 60 * 60 * 1000;
  }

  private signAccessToken(user: PublicUser): string {
    const ttlSeconds = this.getAccessTtlSeconds();
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        departmentId: user.departmentId,
      },
      this.getAccessSecret(),
      { expiresIn: `${ttlSeconds}s` },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  private getRefreshExpiresAt(): Date {
    const now = Date.now();
    return new Date(now + this.getRefreshCookieMaxAgeMs());
  }

  private getAccessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException('JWT_ACCESS_SECRET is not configured');
    }
    return secret;
  }

  private getAccessTtlSeconds(): number {
    const ttlRaw = process.env.JWT_ACCESS_TTL_SECONDS?.trim() || '600';
    const ttl = Number(ttlRaw);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException('JWT_ACCESS_TTL_SECONDS is invalid');
    }
    return ttl;
  }

  private getRefreshTtlDays(): number {
    const ttlRaw = process.env.REFRESH_TOKEN_TTL_DAYS?.trim() || '30';
    const ttl = Number(ttlRaw);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new InternalServerErrorException('REFRESH_TOKEN_TTL_DAYS is invalid');
    }
    return ttl;
  }

  private getUsersServiceUrl(): string {
    const usersServiceUrl = process.env.SERVICE_USERS_URL?.trim();
    if (!usersServiceUrl) {
      throw new InternalServerErrorException('SERVICE_USERS_URL is not configured');
    }
    return usersServiceUrl.replace(/\/+$/, '');
  }

  private async callUsers<T>(
    path: string,
    payload: unknown,
    defaultErrorMessage: string,
    method = 'POST',
    expectedStatus?: number,
  ): Promise<T> {
    const targetUrl = `${this.getUsersServiceUrl()}${path}`;
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
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException({
        message: "Unable to reach service 'users'",
        body: null,
      });
    }

    const parsedBody = await this.parseResponseBody(upstream);
    if (!upstream.ok || (expectedStatus && upstream.status !== expectedStatus)) {
      const responseBody = parsedBody as UpstreamErrorBody | null;
      throw new HttpException(
        {
          message: this.extractMessage(responseBody) ?? defaultErrorMessage,
          body: responseBody?.body ?? parsedBody ?? null,
        },
        upstream.status,
      );
    }

    return parsedBody as T;
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
