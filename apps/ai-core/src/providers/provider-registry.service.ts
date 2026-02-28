import { Injectable } from '@nestjs/common';
import { Logger } from '@ai-adaptar/common';
import { AIProvider, ProviderConfig } from '@ai-adaptar/interfaces';

/**
 * 提供商注册表
 * 管理提供商类型和配置
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providerTypes = new Map<string, new () => AIProvider>();
  private readonly providerConfigs = new Map<string, ProviderConfig>();

  /**
   * 注册提供商类型
   */
  registerProviderType(name: string, providerClass: new () => AIProvider) {
    this.providerTypes.set(name, providerClass);
    this.logger.debug(`Registered provider type: ${name}`);
  }

  /**
   * 创建提供商实例
   */
  createProvider(name: string, config?: ProviderConfig): AIProvider {
    const ProviderClass = this.providerTypes.get(name);

    if (!ProviderClass) {
      throw new Error(`Provider type not found: ${name}`);
    }

    const provider = new ProviderClass();

    if (config) {
      provider.initialize(config).catch(error => {
        this.logger.error(`Failed to initialize provider ${name}:`, error);
      });
    }

    return provider;
  }

  /**
   * 获取提供商配置
   */
  getProviderConfig(name: string): ProviderConfig | undefined {
    return this.providerConfigs.get(name);
  }

  /**
   * 设置提供商配置
   */
  setProviderConfig(name: string, config: ProviderConfig) {
    this.providerConfigs.set(name, config);
    this.logger.debug(`Set config for provider: ${name}`);
  }

  /**
   * 获取所有已注册的提供商类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.providerTypes.keys());
  }

  // TODO: 添加配置验证
  // TODO: 添加配置热更新
}
