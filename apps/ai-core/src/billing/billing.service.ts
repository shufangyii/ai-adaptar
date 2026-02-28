import { Injectable, NotFoundException } from '@nestjs/common';
import { UsageRecordRepository, QuotaRepository } from '@ai-adaptar/database';
import { ModelMappingService } from '../model-mapping/model-mapping.service';
import { ModelInfo } from '@ai-adaptar/interfaces';

/**
 * 计费服务
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly usageRecordRepo: UsageRecordRepository,
    private readonly quotaRepo: QuotaRepository,
    private readonly modelMapping: ModelMappingService,
  ) {}

  /**
   * 记录使用情况
   */
  async recordUsage(data: {
    userId: string;
    provider: string;
    model: string;
    operation: 'chat' | 'embedding' | 'image' | 'audio';
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestId?: string;
    metadata?: Record<string, any>;
  }): Promise<UsageRecord> {
    // 计算成本
    const cost = await this.calculateCost(
      data.provider,
      data.model,
      data.inputTokens,
      data.outputTokens,
    );

    // 创建使用记录
    const record = await this.usageRecordRepo.create({
      userId: data.userId,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.totalTokens,
      cost,
      metadata: data.metadata,
      requestId: data.requestId,
    });

    // 更新配额使用量
    await this.updateQuotaUsage(data.userId, data.totalTokens);

    return record;
  }

  /**
   * 获取使用统计
   */
  async getUsageStatistics(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<{
    periodStart: number;
    periodEnd: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    breakdown: {
      byModel: Record<string, { requests: number; tokens: number; cost: number }>;
      byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
      byOperation: Record<string, { requests: number; tokens: number; cost: number }>;
    };
  }> {
    const { startDate, endDate } = this.getDateRange(period);

    const statistics = await this.usageRecordRepo.getUserStatistics(userId, startDate, endDate);

    return {
      periodStart: startDate.getTime(),
      periodEnd: endDate.getTime(),
      totalRequests: statistics.totalRequests,
      totalTokens: statistics.totalTokens,
      totalCost: statistics.totalCost,
      breakdown: {
        byModel: statistics.byModel,
        byProvider: statistics.byProvider,
        byOperation: statistics.byOperation,
      },
    };
  }

  /**
   * 检查配额
   */
  async checkQuota(
    userId: string,
    model: string,
    estimatedTokens?: number,
  ): Promise<{
    allowed: boolean;
    quota: {
      limit: number;
      used: number;
      remaining: number;
      resetAt: number;
    };
    estimatedCost?: number;
  }> {
    // 获取月度配额
    const monthlyQuota = await this.quotaRepo.getQuotaInfo(userId, 'monthly');

    if (!monthlyQuota) {
      // 如果没有设置配额，允许请求
      return {
        allowed: true,
        quota: {
          limit: 0,
          used: 0,
          remaining: 0,
          resetAt: 0,
        },
      };
    }

    // 如果提供了预估 token 数，检查是否有足够配额
    if (estimatedTokens && monthlyQuota.remaining < estimatedTokens) {
      return {
        allowed: false,
        quota: {
          limit: monthlyQuota.limit,
          used: monthlyQuota.used,
          remaining: monthlyQuota.remaining,
          resetAt: monthlyQuota.resetAt.getTime(),
        },
      };
    }

    // 计算预估成本
    let estimatedCost: number | undefined;
    if (estimatedTokens) {
      const modelInfo = await this.modelMapping.getModelInfo(model);
      if (modelInfo?.pricing) {
        // 简单估算：假设 50% 输入，50% 输出
        const inputTokens = Math.floor(estimatedTokens * 0.5);
        const outputTokens = Math.floor(estimatedTokens * 0.5);
        estimatedCost = this.calculateCostFromPricing(
          modelInfo.pricing,
          inputTokens,
          outputTokens,
        );
      }
    }

    return {
      allowed: true,
      quota: {
        limit: monthlyQuota.limit,
        used: monthlyQuota.used,
        remaining: monthlyQuota.remaining,
        resetAt: monthlyQuota.resetAt.getTime(),
      },
      estimatedCost,
    };
  }

  /**
   * 计算成本
   */
  private async calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<number> {
    const modelInfo = await this.modelMapping.getModelInfo(model);

    if (!modelInfo?.pricing) {
      // 如果没有定价信息，返回 0
      return 0;
    }

    return this.calculateCostFromPricing(modelInfo.pricing, inputTokens, outputTokens);
  }

  /**
   * 根据定价计算成本
   */
  private calculateCostFromPricing(
    pricing: { input: number; output: number; currency?: string },
    inputTokens: number,
    outputTokens: number,
  ): number {
    // 价格是 per 1M tokens
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * 更新配额使用量
   */
  private async updateQuotaUsage(userId: string, tokens: number): Promise<void> {
    try {
      await this.quotaRepo.incrementUsed(userId, 'monthly', tokens);
    } catch (error) {
      // 如果更新失败（可能是配额不存在），记录错误但不抛出异常
      console.error('Failed to update quota usage:', error);
    }
  }

  /**
   * 获取日期范围
   */
  private getDateRange(period: 'day' | 'week' | 'month' | 'year'): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    const startDate = new Date(now);

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return { startDate, endDate };
  }
}
