import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    // 构建错误响应
    const errorResponse = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      ...(typeof message === 'string'
        ? { message }
        : message),
    };

    // 记录错误日志
    console.error('Exception caught:', {
      error: exception,
      request: {
        method: request.method,
        url: request.url,
        body: request.body,
        headers: request.headers,
      },
    });

    response.status(status).json(errorResponse);
  }
}

/**
 * AI 适配器异常过滤器
 */
@Catch(HttpException)
export class AiAdapterExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      error: {
        message: '',
        type: 'api_error',
        code: 'UNKNOWN_ERROR',
        param: null,
        details: null,
      },
    };

    // 处理不同类型的错误响应
    if (typeof exceptionResponse === 'string') {
      errorResponse.error.message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as any;
      errorResponse.error.message = responseObj.message || responseObj.error?.message || 'An error occurred';
      errorResponse.error.code = responseObj.code || responseObj.error?.code || 'UNKNOWN_ERROR';
      errorResponse.error.type = responseObj.type || responseObj.error?.type || 'api_error';
      errorResponse.error.details = responseObj.details || responseObj.error?.details || null;
    }

    // 添加 OpenAI 兼容格式
    response.status(status).json({
      ...errorResponse,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}

// TODO: 添加 RPC 异常过滤器（用于微服务通信）
// TODO: 添加流式响应异常处理
