import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Quota } from '../entities/quota.entity';

/**
 * 配额仓储
 */
@Injectable()
export class QuotaRepository {
  constructor(
    @InjectRepository(Quota)
    private readonly repository: Repository<Quota>,
  ) {}

  /**
   * 创建配额
   */
  async create(data: Partial<Quota>): Promise<Quota> {
    const quota = this.repository.create(data);
    return this.repository.save(quota);
  }

  /**
   * 根据用户 ID 查询配额
   */
  async findByUserId(userId: string): Promise<Quota[]> {
    return this.repository.find({
      where: { userId },
      order: { type: 'DESC' },
    });
  }

  /**
   * 根据用户 ID 和类型查询配额
   */
  async findByUserIdAndType(userId: string, type: 'monthly' | 'daily' | 'request'): Promise<Quota | null> {
    return this.repository.findOne({
      where: { userId, type },
    });
  }

  /**
   * 更新配额使用量
   */
  async incrementUsed(userId: string, type: 'monthly' | 'daily' | 'request', amount: number): Promise<Quota | null> {
    const quota = await this.findByUserIdAndType(userId, type);
    if (!quota) {
      return null;
    }

    quota.used += amount;
    quota.updatedAt = new Date();
    return this.repository.save(quota);
  }

  /**
   * 重置配额
   */
  async resetQuota(userId: string, type: 'monthly' | 'daily' | 'request'): Promise<Quota | null> {
    const quota = await this.findByUserIdAndType(userId, type);
    if (!quota) {
      return null;
    }

    quota.used = 0;
    const now = new Date();

    // 计算下次重置时间
    if (type === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      quota.resetAt = tomorrow;
    } else if (type === 'monthly') {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      quota.resetAt = nextMonth;
    }

    quota.updatedAt = now;
    return this.repository.save(quota);
  }

  /**
   * 检查配额是否���用
   */
  async checkAvailable(userId: string, type: 'monthly' | 'daily' | 'request', required: number): Promise<boolean> {
    const quota = await this.findByUserIdAndType(userId, type);
    if (!quota) {
      return false;
    }

    // 检查是否需要重置
    const now = new Date();
    if (now >= quota.resetAt) {
      await this.resetQuota(userId, type);
      const refreshed = await this.findByUserIdAndType(userId, type);
      return (refreshed?.limit || 0) >= required;
    }

    return quota.remaining >= required;
  }

  /**
   * 获取配额信息
   */
  async getQuotaInfo(userId: string, type: 'monthly' | 'daily' | 'request'): Promise<{
    limit: number;
    used: number;
    remaining: number;
    resetAt: Date;
    isExceeded: boolean;
  } | null> {
    const quota = await this.findByUserIdAndType(userId, type);
    if (!quota) {
      return null;
    }

    // 检查是否需要重置
    const now = new Date();
    if (now >= quota.resetAt) {
      await this.resetQuota(userId, type);
      const refreshed = await this.findByUserIdAndType(userId, type);
      if (!refreshed) {
        return null;
      }
      return {
        limit: refreshed.limit,
        used: refreshed.used,
        remaining: refreshed.remaining,
        resetAt: refreshed.resetAt,
        isExceeded: refreshed.isExceeded,
      };
    }

    return {
      limit: quota.limit,
      used: quota.used,
      remaining: quota.remaining,
      resetAt: quota.resetAt,
      isExceeded: quota.isExceeded,
    };
  }

  /**
   * 删除过期的配额
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('resetAt < :now', { now })
      .execute();

    return result.affected || 0;
  }
}
