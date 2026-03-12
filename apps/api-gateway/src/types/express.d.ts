import { RateLimitConfig } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        tenantId: string;
        keyHash: string;
        rateLimitConfig?: Partial<RateLimitConfig>;
      };
    }
  }
}
