import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RateLimitService } from '../modules/rate-limit/rate-limit.service';

/**
 * 限流守卫 (RateLimitGuard)
 *
 * 功能：
 * 1. 检查 API Key 的 QPS（每秒请求数）限制
 * 2. 检查 TPM（每分钟请求数）限制
 * 3. 检查并发连接数限制
 * 4. 针对特定模型的 QPS 限制（mqps）
 *
 * 依赖：需要 AuthGuard 先执行，以获取 request.user.rateLimitConfig
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  /**
   * 权限守卫的核心方法
   *
   * @param context NestJS 执行上下文
   * @returns boolean - 如果通过限流检查返回 true
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 测试模式：如果请求头包含 x-test-rate-limit: true，强制返回 429
    if (request.headers['x-test-rate-limit'] === 'true') {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 如果没有限流配置，跳过限流检查（Fail Open 策略）
    if (!request.user || !request.user.rateLimitConfig) {
      return true;
    }

    // 提取认证信息
    const { keyHash, tenantId, rateLimitConfig } = request.user;

    // 1. 提取客户端 IP 地址（支持 X-Forwarded-For 头）
    const ip =
      (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';

    // 2. 提取目标模型（如果请求体中包含 model 字段）
    // 注意：如果是流式请求，request.body 可能为空或不完整
    let model = 'default';
    const body = request.body as Record<string, unknown> | undefined;
    if (body && typeof body.model === 'string') {
      model = body.model;
    }

    // 3. 获取限流参数（如果未配置则使用默认值）
    const qpsLimit = rateLimitConfig.qpsLimit ?? 60; // 默认每秒 60 次
    const tpmLimit = rateLimitConfig.tpmLimit ?? 10000; // 默认每分钟 10000 次
    const concurrentLimit = rateLimitConfig.concurrent ?? 5; // 默认并发 5 个

    // 4. 调用限流服务进行检查
    await this.rateLimitService.checkLimits({
      ip,
      apiKeyHash: keyHash,
      tenantId,
      model,
      qpsLimit,
      tpmLimit,
      concurrentLimit,
    });

    return true;
  }
}
