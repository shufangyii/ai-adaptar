import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsageRecord } from '../entities/usage-record.entity';

/**
 * 使用记录仓储
 */
@Injectable()
export class UsageRecordRepository {
  constructor(
    @InjectRepository(UsageRecord)
    private readonly repository: Repository<UsageRecord>,
  ) {}

  /**
   * 创建使用记录
   */
  async create(data: Partial<UsageRecord>): Promise<UsageRecord> {
    const record = this.repository.create(data);
    return this.repository.save(record);
  }

  /**
   * 批量创建使用记录
   */
  async createMany(data: Partial<UsageRecord>[]): Promise<UsageRecord[]> {
    const records = this.repository.create(data);
    return this.repository.save(records);
  }

  /**
   * 根据用户 ID 和时间范围查询使用记录
   */
  async findByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageRecord[]> {
    return this.repository.find({
      where: {
        userId,
        createdAt: Between(startDate, endDate),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * 获取用户的使用统计
   */
  async getUserStatistics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
    byOperation: Record<string, { requests: number; tokens: number; cost: number }>;
  }> {
    const records = await this.findByUserIdAndDateRange(userId, startDate, endDate);

    const statistics = {
      totalRequests: records.length,
      totalTokens: 0,
      totalCost: 0,
      byModel: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byProvider: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byOperation: {} as Record<string, { requests: number; tokens: number; cost: number }>,
    };

    for (const record of records) {
      statistics.totalTokens += record.totalTokens;
      statistics.totalCost += Number(record.cost);

      // 按模型统计
      if (!statistics.byModel[record.model]) {
        statistics.byModel[record.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      statistics.byModel[record.model].requests++;
      statistics.byModel[record.model].tokens += record.totalTokens;
      statistics.byModel[record.model].cost += Number(record.cost);

      // 按提供商统计
      if (!statistics.byProvider[record.provider]) {
        statistics.byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      statistics.byProvider[record.provider].requests++;
      statistics.byProvider[record.provider].tokens += record.totalTokens;
      statistics.byProvider[record.provider].cost += Number(record.cost);

      // 按操作类型统计
      if (!statistics.byOperation[record.operation]) {
        statistics.byOperation[record.operation] = { requests: 0, tokens: 0, cost: 0 };
      }
      statistics.byOperation[record.operation].requests++;
      statistics.byOperation[record.operation].tokens += record.totalTokens;
      statistics.byOperation[record.operation].cost += Number(record.cost);
    }

    return statistics;
  }

  /**
   * 根据请求 ID 查询
   */
  async findByRequestId(requestId: string): Promise<UsageRecord | null> {
    return this.repository.findOne({ where: { requestId } });
  }

  /**
   * 删除过期的使用记录
   */
  async deleteOldRecords(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
