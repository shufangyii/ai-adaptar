import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * API Key 认证守卫
 * 用于保护需要 API Key 认证的路由
 */
@Injectable()
export class ApiKeyAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    // private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否使用了 @Public() 装饰器
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    // TODO: 验证 API Key
    // try {
    //   const user = await this.authService.validateApiKey(apiKey);
    //   request.user = user;
    //   return true;
    // } catch (error) {
    //   throw new UnauthorizedException('Invalid API key');
    // }

    return true;
  }

  private extractApiKey(request: any): string | null {
    // 从 Authorization header 提取
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // 检查是否是 API Key 格式
      if (token.startsWith('aiadaptar_')) {
        return token;
      }
    }

    // 从 X-API-Key header 提取
    return request.headers['x-api-key'] || null;
  }
}

/**
 * 组合认证守卫
 * 支持 JWT 或 API Key 认证
 */
@Injectable()
export class CombinedAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    // private readonly authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否使用了 @Public() 装饰器
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // 检查是否有 API Key
    const apiKey = this.extractApiKey(request);

    if (apiKey) {
      // 使用 API Key 认证
      // TODO: 实现完整的 API Key 验证
      return true;
    }

    // 使用 JWT 认证
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  private extractApiKey(request: any): string | null {
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('aiadaptar_')) {
        return token;
      }
    }

    return request.headers['x-api-key'] || null;
  }
}
