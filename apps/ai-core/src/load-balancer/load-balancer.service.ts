import { Injectable } from '@nestjs/common';
import { Logger } from '@ai-adaptar/common';
import { AIProvider } from '@ai-adaptar/interfaces';
import { ProviderManager } from '../providers/provider-manager.service';
import { ModelMappingService } from '../model-mapping/model-mapping.service';

/**
 * 负载均衡策略
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  RANDOM = 'random',
  WEIGHTED = 'weighted',
}

/**
 * 提供商状态
 */
interface ProviderStatus {
  provider: AIProvider;
  connections: number;
  errors: number;
  lastError?: number;
  healthy: boolean;
}

/**
 * 负载均衡服务
 * 根据策略选择合适的提供商
 */
@Injectable()
export class LoadBalancer {
  private readonly logger = new Logger(LoadBalancer.name);
  private readonly providerStatus = new Map<string, ProviderStatus>();
  private roundRobinIndex = 0;

  private strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN;

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly modelMapping: ModelMappingService,
  ) {}

  /**
   * 选择提供商
   */
  async selectProvider(
    model: string,
    preferredProvider?: string,
  ): Promise<AIProvider> {
    // 如果指定了提供商，直接返回
    if (preferredProvider) {
      const provider = this.providerManager.getProvider(preferredProvider);
      if (provider) {
        return provider;
      }
      this.logger.warn(`Preferred provider ${preferredProvider} not found, using load balancing`);
    }

    // 获取支持该模型的所有提供商
    const modelInfo = await this.modelMapping.getModelInfo(model);
    if (!modelInfo) {
      throw new Error(`Model not found: ${model}`);
    }

    const availableProviders = await this.getAvailableProviders(model);
    if (availableProviders.length === 0) {
      throw new Error(`No available providers for model: ${model}`);
    }

    // 根据策略选择提供商
    return this.selectByStrategy(availableProviders);
  }

  /**
   * 获取可用的提供商列表
   */
  private async getAvailableProviders(model: string): Promise<ProviderStatus[]> {
    const providers = await this.providerManager.getAllProviders();
    const available: ProviderStatus[] = [];

    for (const provider of providers) {
      const supportedModels = provider.getSupportedModels();
      if (supportedModels.includes(model)) {
        let status = this.providerStatus.get(provider.name);

        if (!status) {
          const healthy = await provider.healthCheck();
          status = {
            provider,
            connections: 0,
            errors: 0,
            healthy,
          };
          this.providerStatus.set(provider.name, status);
        }

        if (status.healthy) {
          available.push(status);
        }
      }
    }

    return available;
  }

  /**
   * 根据策略选择提供商
   */
  private selectByStrategy(providers: ProviderStatus[]): AIProvider {
    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(providers);

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.selectLeastConnections(providers);

      case LoadBalancingStrategy.RANDOM:
        return this.selectRandom(providers);

      case LoadBalancingStrategy.WEIGHTED:
        return this.selectWeighted(providers);

      default:
        return this.selectRoundRobin(providers);
    }
  }

  /**
   * 轮询选择
   */
  private selectRoundRobin(providers: ProviderStatus[]): AIProvider {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    provider.connections++;
    return provider.provider;
  }

  /**
   * 最少连接选择
   */
  private selectLeastConnections(providers: ProviderStatus[]): AIProvider {
    providers.sort((a, b) => a.connections - b.connections);
    const selected = providers[0];
    selected.connections++;
    return selected.provider;
  }

  /**
   * 随机选择
   */
  private selectRandom(providers: ProviderStatus[]): AIProvider {
    const index = Math.floor(Math.random() * providers.length);
    const selected = providers[index];
    selected.connections++;
    return selected.provider;
  }

  /**
   * 加权选择 (TODO: 实现权重配置)
   */
  private selectWeighted(providers: ProviderStatus[]): AIProvider {
    // 简化实现：使用轮询
    return this.selectRoundRobin(providers);
  }

  /**
   * 记录请求完成
   */
  recordCompletion(providerName: string, error?: boolean) {
    const status = this.providerStatus.get(providerName);
    if (status) {
      status.connections = Math.max(0, status.connections - 1);
      if (error) {
        status.errors++;
        status.lastError = Date.now();
      }
    }
  }

  /**
   * 设置负载均衡策略
   */
  setStrategy(strategy: LoadBalancingStrategy) {
    this.strategy = strategy;
    this.logger.log(`Load balancing strategy set to: ${strategy}`);
  }

  // TODO: 实现权重配置
  // TODO: 实现熔断机制
  // TODO: 实现健康检查和自动恢复
}
