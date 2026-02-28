import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JWT 认证守卫
 * 用于保护需要认证的路由
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 检查是否使用了 @Public() 装饰器
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

/**
 * 可选的 JWT 认证守卫
 * 允许请求在没有 token 的情况下通过，但会在有 token 时验证
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super({ defaultStrategy: 'jwt', passReqToCallback: true });
  }

  handleRequest(err: any, user: any, info: any) {
    // 即使没有 token 或验证失败，也不抛出错误
    if (err || !user) {
      return null;
    }
    return user;
  }
}
