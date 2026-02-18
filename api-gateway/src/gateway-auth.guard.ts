import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class GatewayAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Placeholder guard for now. Real auth logic will be added later.
    return true;
  }
}
