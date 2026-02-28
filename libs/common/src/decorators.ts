import { SetMetadata } from '@nestjs/common';

/**
 * 公共接口装饰器（不需要认证）
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * 速率限制装饰器
 */
export const RateLimit = (limit: number, window?: number) =>
  SetMetadata('rateLimit', { limit, window });

/**
 * 模型可用性装饰器
 */
export const AvailableModels = (...models: string[]) =>
  SetMetadata('availableModels', models);

// TODO: 添加更多装饰器
