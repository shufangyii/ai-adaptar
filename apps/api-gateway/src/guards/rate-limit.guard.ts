import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // TODO (Phase 2): Implement 5-dimensional rate limiting using Redis Lua script.
    // Dimensions to check: IP, Key QPS, Key Concurrent, Project TPM, Model QPS.
    // Ensure we track connections and free them when streams close.
    // For now (Phase 1), allow all unless a specific header asks to test HTTP 429
    if (request.headers['x-test-rate-limit'] === 'true') {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
