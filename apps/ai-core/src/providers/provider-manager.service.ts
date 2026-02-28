import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService, MetadataAccessor } from '@nestjs/core';
import { Logger } from '@ai-adaptar/common';
import { AIProvider, ProviderConfig } from '@ai-adaptar/interfaces';

/**
 * 提供商管理服务
 * 负责管理和协调所有 AI 提供商适配器
 */
@Injectable()
export class ProviderManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderManager.name);
  private readonly providers = new Map<string, AIProvider>();
  private readonly providerConfigs = new Map<string, ProviderConfig>();

  constructor(
    // TODO: 注入 DiscoveryService 来自动发现提供商
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Provider Manager...');
    // TODO: 自动发现和注册提供商
    await this.initializeProviders();
  }

  async onModuleDestroy() {
    this.logger.log('Cleaning up providers...');
    for (const [name, provider] of this.providers) {
      try {
        await provider.cleanup();
      } catch (error) {
        this.logger.error(`Error cleaning up provider ${name}:`, error);
      }
    }
  }

  /**
   * 注册提供商
   */
  registerProvider(name: string, provider: AIProvider) {
    this.providers.set(name, provider);
    this.logger.log(`Registered provider: ${name}`);
  }

  /**
   * 获取提供商
   */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * 获取所有提供商
   */
  async getAllProviders(): Promise<AIProvider[]> {
    return Array.from(this.providers.values());
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        health[name] = await provider.healthCheck();
      } catch {
        health[name] = false;
      }
    }

    return health;
  }

  /**
   * 初始化所有提供商
   */
  private async initializeProviders() {
    // TODO: 从配置或环境变量加载提供商配置
    // TODO: 根据配置初始化提供商

    this.logger.log(`Initialized ${this.providers.size} providers`);
  }

  // TODO: 添加提供商热重载功能
  // TODO: 添加提供商状态监控
}
