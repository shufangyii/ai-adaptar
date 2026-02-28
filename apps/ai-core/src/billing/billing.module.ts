import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from '../controllers/billing.controller';
import { UsageRecord } from '@ai-adaptar/database';
import { UsageRecordRepository, QuotaRepository } from '@ai-adaptar/database';
import { ModelMappingService } from '../model-mapping/model-mapping.service';

/**
 * 计费模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord])],
  controllers: [BillingController],
  providers: [BillingService, UsageRecordRepository, QuotaRepository],
  exports: [BillingService],
})
export class BillingModule {}
