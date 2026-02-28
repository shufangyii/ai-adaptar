import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ModelMappingService } from '../model-mapping/model-mapping.service';
import { BillingService } from '../billing/billing.service';

@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly modelMapping: ModelMappingService,
    private readonly billingService: BillingService,
  ) {}

  @EventPattern('billing.usage')
  async getUsage(@Payload() data: { userId: string; period?: string }, @Ctx() context: RmqContext): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Getting usage for user: ${data.userId}`);

      const period = (data.period as 'day' | 'week' | 'month' | 'year') || 'month';
      return this.billingService.getUsageStatistics(data.userId, period);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting usage:`, error);
      throw error;
    }
  }

  @EventPattern('billing.usage.period')
  async getUsageByPeriod(
    @Payload() data: { userId: string; period: string },
    @Ctx() context: RmqContext,
  ): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Getting usage for user: ${data.userId}, period: ${data.period}`);

      const period = data.period as 'day' | 'week' | 'month' | 'year';
      return this.billingService.getUsageStatistics(data.userId, period);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error getting usage by period:`, error);
      throw error;
    }
  }

  @EventPattern('billing.quota.check')
  async checkQuota(
    @Payload() data: { userId: string; model: string; estimatedTokens?: number },
    @Ctx() context: RmqContext,
  ): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Checking quota for user: ${data.userId}, model: ${data.model}`);

      return this.billingService.checkQuota(data.userId, data.model, data.estimatedTokens);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error checking quota:`, error);
      throw error;
    }
  }

  @EventPattern('billing.usage.record')
  async recordUsage(
    @Payload() data: {
      userId: string;
      provider: string;
      model: string;
      operation: 'chat' | 'embedding' | 'image' | 'audio';
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      requestId?: string;
      metadata?: Record<string, any>;
    },
    @Ctx() context: RmqContext,
  ): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Recording usage for user: ${data.userId}`);

      const record = await this.billingService.recordUsage(data);
      return {
        success: true,
        recordId: record.id,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error recording usage:`, error);
      throw error;
    }
  }

  private getCorrelationId(context: RmqContext): string {
    const message = context.getMessage();
    return message.properties?.correlationId || 'unknown';
  }
}
