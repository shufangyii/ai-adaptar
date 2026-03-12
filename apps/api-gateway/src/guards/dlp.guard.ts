import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DlpService } from '../modules/dlp/dlp.service';

/**
 * 数据丢失防护守卫 (DLPGuard)
 *
 * 功能：
 * 1. 扫描请求体中的敏感信息（PII）
 * 2. 检测 Prompt Injection 攻击（如 "ignore previous instructions"）
 * 3. 发现违规内容时返回 400 Bad Request
 *
 * 策略：Fail Open（DLP 扫描出错时允许请求，不影响正常业务）
 * 原因：避免误杀合法请求
 */
@Injectable()
export class DlpGuard implements CanActivate {
  private readonly logger = new Logger(DlpGuard.name);

  constructor(private readonly dlpService: DlpService) {}

  /**
   * 权限守卫的核心方法
   *
   * @param context NestJS 执行上下文
   * @returns boolean - 如果通过 DLP 检查返回 true，否则抛出 400 错误
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 只扫描请求体中可能包含提示词的字段（通常是 message.content 或类似字段）
    if (request.body && typeof request.body === 'object') {
      try {
        // 执行 DLP 扫描
        const isSafe = this.dlpService.scanPayload(request.body);

        // 如果发现违规内容，拒绝请求
        if (!isSafe) {
          throw new HttpException(
            'Request blocked by Data Loss Prevention (DLP) policy. Found PII or Injection signatures.',
            HttpStatus.BAD_REQUEST,
          );
        }
      } catch (err: unknown) {
        // 1. 如果是 DLP 抛出的业务错误，直接抛出
        if (err instanceof HttpException) {
          throw err;
        }

        // 2. 如果是内部错误（如 DLP 扫描服务崩溃），采用 Fail Open 策略
        this.logger.error('DLP Guard encountered an unexpected error', err);
      }
    }

    return true; // 通过检查或优雅降级
  }
}
