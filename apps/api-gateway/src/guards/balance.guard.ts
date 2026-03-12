import { RedisService } from '@llm-gateway/redis';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * 余额检查守卫 (BalanceGuard)
 *
 * 功能：
 * 1. 检查租户账户余额是否充足
 * 2. 防止欠费用户继续使用服务
 * 3. 余额阈值：低于 0 时返回 402 Payment Required
 *
 * 策略：Fail Open（余额未找到时允许请求，后台 worker 会同步余额）
 * 原因：避免 Redis 不可用时阻塞正常业务
 */
@Injectable()
export class BalanceGuard implements CanActivate {
  private readonly logger = new Logger(BalanceGuard.name);

  // 余额阈值：低于此值时拒绝请求
  private readonly BALANCE_THRESHOLD = 0;

  constructor(private readonly redis: RedisService) {}

  /**
   * 权限守卫的核心方法
   *
   * @param context NestJS 执行上下文
   * @returns boolean - 如果余额充足返回 true，否则抛出 402 错误
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 此守卫依赖 AuthGuard 先执行，以确保 request.user 存在
    if (!request.user || !request.user.tenantId) {
      return true; // 如果没有 tenantId，跳过检查（Fail Open）
    }

    const { tenantId } = request.user;
    const balanceKey = `tenant:${tenantId}:balance`;

    try {
      // 1. 从 Redis 读取租户余额
      const balanceStr = await this.redis.get(balanceKey);

      // 2. 如果余额未找到，采用 Fail Open 策略
      // 后台 worker 会定期从数据库同步余额到 Redis
      if (balanceStr === null) {
        return true;
      }

      // 3. 解析余额数值
      const balance = parseFloat(balanceStr);

      // 4. 检查余额是否充足
      if (!isNaN(balance) && balance <= this.BALANCE_THRESHOLD) {
        this.logger.warn(
          `Tenant ${tenantId} blocked: Insufficient balance (${balance})`,
        );
        throw new HttpException(
          'Insufficient balance. Please recharge your account.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      return true;
    } catch (err: unknown) {
      // 5. 区分业务错误和其他错误
      if (err instanceof HttpException) {
        throw err;
      }

      // 6. 如果 Redis 连接失败，采用 Fail Open 策略（避免阻塞业务）
      this.logger.error('Failed to check balance watermark', err);
      return true;
    }
  }
}
