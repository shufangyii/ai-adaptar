import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string;
    keyHash: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];

    // TODO (Phase 2): Verify token hash with DB/Redis cache (e.g., using Prisma/ioredis)
    // For Phase 1 (MVP), we just do a simple dummy check to return 401 if 'invalid'
    if (token === 'invalid-key') {
      throw new UnauthorizedException('Invalid API Key');
    }

    // Attach tenant/user info to request. This is critical for subsequent guards
    // like RateLimitGuard or the Interceptor which needs tenant context to record logs.
    request.user = {
      tenantId: 'dummy-tenant-id',
      keyHash: 'dummy-hash',
    };

    return true;
  }
}
