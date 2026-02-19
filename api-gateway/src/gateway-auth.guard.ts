import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AccessTokenClaims } from './auth/auth.service';

type AuthenticatedRequest = Request & {
  user?: AccessTokenClaims;
};

const PUBLIC_PATHS = new Set<string>([
  '/health',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
]);

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.method.toUpperCase() === 'OPTIONS') {
      return true;
    }

    if (PUBLIC_PATHS.has(request.path)) {
      return true;
    }

    if (this.isTrustedInternalRequest(request)) {
      return true;
    }

    const authHeader = request.header('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = this.authService.verifyAccessToken(token);
    return true;
  }

  private isTrustedInternalRequest(request: Request): boolean {
    const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();
    if (!internalKey) {
      return false;
    }

    const incoming = request.header('x-internal-key');
    return incoming === internalKey;
  }
}
