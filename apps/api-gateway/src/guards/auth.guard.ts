import { PrismaService } from '@llm-gateway/database';
import { RedisService } from '@llm-gateway/redis';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RateLimitConfig } from '@prisma/client';
import { createHash } from 'crypto';
import { Request } from 'express';

/**
 * API Key 认证守卫 (AuthGuard)
 *
 * 功能：
 * 1. 验证请求头中的 Bearer Token
 * 2. 通过 Redis 缓存 API Key 信息，减少数据库查询
 * 3. 缓存无效/过期的 API Key，防止恶意请求
 * 4. 将 tenantId 和 rateLimitConfig 注入到 request.user 中供后续使用
 *
 * 策略：先查 Redis 缓存，缓存未命中再查数据库
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 权限守卫的核心方法
   * 检查请求是否携带有效的 API Key
   *
   * @param context NestJS 的执行上下文
   * @returns boolean - 如果认证通过返回 true，否则抛出 UnauthorizedException
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // 1. 验证 Authorization 头存在且格式正确
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    // 2. 提取 Bearer Token
    const token = authHeader.split(' ')[1];

    // 3. 使用 SHA-256 对 API Key 进行哈希（安全性：不存储明文密钥）
    const keyHash = createHash('sha256').update(token).digest('hex');
    const cacheKey = `apikey:${keyHash}`;

    try {
      // 4. 优先从 Redis 缓存读取（减少数据库压力）
      const cachedDataStr = await this.redis.get(cacheKey);

      if (cachedDataStr) {
        // 4.1 如果缓存的是 'INVALID'，直接拒绝请求
        if (cachedDataStr === 'INVALID') {
          throw new UnauthorizedException('Invalid API Key');
        }

        // 4.2 解析缓存的 API Key 信息
        const cachedData = JSON.parse(cachedDataStr) as {
          tenantId: string;
          rateLimitConfig?: Partial<RateLimitConfig>;
        };
        // 将用户信息注入到 request.user，供后续守卫使用
        request.user = {
          tenantId: cachedData.tenantId,
          keyHash: keyHash,
          rateLimitConfig: cachedData.rateLimitConfig,
        };
        return true;
      }

      // 5. 缓存未命中，从数据库查询 API Key
      const apiKeyRecord = await this.prisma.apiKey.findFirst({
        where: {
          keyHash: keyHash,
          status: 'ACTIVE', // 只查找状态为 ACTIVE 的 API Key
        },
        include: {
          tenant: true, // 包含关联的 Tenant 信息
          rateLimitConfig: true, // 包含限流配置
        },
      });

      // 6. 处理无效或已失效的 API Key
      if (!apiKeyRecord || apiKeyRecord.tenant.status !== 'ACTIVE') {
        // 将无效结果缓存 5 分钟（300秒），防止恶意请求击穿数据库
        await this.redis.set(cacheKey, 'INVALID', 300);
        throw new UnauthorizedException('Invalid API Key');
      }

      // 7. 检查 API Key 是否过期
      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        await this.redis.set(cacheKey, 'INVALID', 300);
        throw new UnauthorizedException('API Key has expired');
      }

      // 8. 将有效的 API Key 信息缓存到 Redis（1 小时 TTL）
      const tenantId = apiKeyRecord.tenantId;
      const rateLimitConfig = apiKeyRecord.rateLimitConfig || undefined;

      const cacheValue = JSON.stringify({
        tenantId,
        rateLimitConfig,
      });
      await this.redis.set(cacheKey, cacheValue, 3600);

      // 9. 注入用户信息到 request.user
      request.user = {
        tenantId: tenantId,
        keyHash: keyHash,
        rateLimitConfig,
      };

      return true;
    } catch (error) {
      // 10. 区分已知的认证错误和其他内部错误
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Error during authentication', error);
      // 运行时错误：返回通用错误
      throw new UnauthorizedException(
        'Authentication failed due to internal error',
      );
    }
  }
}
