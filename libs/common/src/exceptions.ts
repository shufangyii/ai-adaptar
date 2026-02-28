import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * AI 适配器基础异常
 */
export class AiAdapterException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    code: string = 'UNKNOWN_ERROR',
  ) {
    super(
      {
        error: {
          message,
          code,
          type: 'ai_adapter_error',
        },
      },
      statusCode,
    );
    this.name = 'AiAdapterException';
  }
}

/**
 * 无效请求异常
 */
export class InvalidRequestException extends AiAdapterException {
  constructor(message: string, details?: any) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'INVALID_REQUEST',
    );
    this.name = 'InvalidRequestException';
    if (details) {
      // @ts-ignore
      this.response.error.details = details;
    }
  }
}

/**
 * 模型未找到异常
 */
export class ModelNotFoundException extends AiAdapterException {
  constructor(model: string) {
    super(
      `Model not found: ${model}`,
      HttpStatus.NOT_FOUND,
      'MODEL_NOT_FOUND',
    );
    this.name = 'ModelNotFoundException';
  }
}

/**
 * 提供商未找到异常
 */
export class ProviderNotFoundException extends AiAdapterException {
  constructor(provider: string) {
    super(
      `Provider not found: ${provider}`,
      HttpStatus.NOT_FOUND,
      'PROVIDER_NOT_FOUND',
    );
    this.name = 'ProviderNotFoundException';
  }
}

/**
 * 提供商不可用异常
 */
export class ProviderUnavailableException extends AiAdapterException {
  constructor(provider: string, reason?: string) {
    super(
      `Provider unavailable: ${provider}${reason ? ` - ${reason}` : ''}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      'PROVIDER_UNAVAILABLE',
    );
    this.name = 'ProviderUnavailableException';
  }
}

/**
 * API Key 无效异常
 */
export class InvalidApiKeyException extends AiAdapterException {
  constructor(provider: string) {
    super(
      `Invalid API key for provider: ${provider}`,
      HttpStatus.UNAUTHORIZED,
      'INVALID_API_KEY',
    );
    this.name = 'InvalidApiKeyException';
  }
}

/**
 * 配额超限异常
 */
export class QuotaExceededException extends AiAdapterException {
  constructor(message: string = 'Quota exceeded') {
    super(
      message,
      HttpStatus.FORBIDDEN,
      'QUOTA_EXCEEDED',
    );
    this.name = 'QuotaExceededException';
  }
}

/**
 * 速率限制异常
 */
export class RateLimitExceededException extends AiAdapterException {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED',
    );
    this.name = 'RateLimitExceededException';
    if (retryAfter) {
      // @ts-ignore
      this.response.error.retry_after = retryAfter;
    }
  }
}

/**
 * 内容被过滤异常
 */
export class ContentFilteredException extends AiAdapterException {
  constructor(reason: string = 'Content filtered') {
    super(
      reason,
      HttpStatus.BAD_REQUEST,
      'CONTENT_FILTERED',
    );
    this.name = 'ContentFilteredException';
  }
}

/**
 * 上下文长度超限异常
 */
export class ContextLengthExceededException extends AiAdapterException {
  constructor(maxTokens: number, providedTokens: number) {
    super(
      `Context length exceeded: maximum ${maxTokens} tokens, provided ${providedTokens} tokens`,
      HttpStatus.BAD_REQUEST,
      'CONTEXT_LENGTH_EXCEEDED',
    );
    this.name = 'ContextLengthExceededException';
    // @ts-ignore
    this.response.error.max_tokens = maxTokens;
    // @ts-ignore
    this.response.error.provided_tokens = providedTokens;
  }
}

// TODO: 添加更多特定异常类型
