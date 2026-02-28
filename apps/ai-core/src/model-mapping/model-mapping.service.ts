import { Injectable } from '@nestjs/common';
import { Logger } from '@ai-adaptar/common';
import { ModelInfo, ModelCapability, ModelPricing } from '@ai-adaptar/interfaces';

/**
 * 模型映射配置
 */
interface ModelMapping {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'completion' | 'embedding' | 'image' | 'audio';
  capability: ModelCapability;
  pricing?: ModelPricing;
  aliases?: string[];
}

/**
 * 模型映射服务
 * 管理模型 ID 到实际提供商模型的映射
 */
@Injectable()
export class ModelMappingService {
  private readonly logger = new Logger(ModelMappingService.name);
  private readonly mappings = new Map<string, ModelMapping>();
  private readonly aliasMap = new Map<string, string>(); // alias -> model id

  constructor() {
    this.initializeMappings();
  }

  /**
   * 获取模型信息
   */
  async getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
    // 先查找别名
    const actualId = this.aliasMap.get(modelId) || modelId;
    const mapping = this.mappings.get(actualId);

    if (!mapping) {
      return undefined;
    }

    return {
      id: mapping.id,
      name: mapping.name,
      provider: mapping.provider,
      type: mapping.type,
      capability: mapping.capability,
      pricing: mapping.pricing,
      status: 'available',
    };
  }

  /**
   * 添加模型映射
   */
  addMapping(mapping: ModelMapping) {
    this.mappings.set(mapping.id, mapping);

    // 注册别名
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        this.aliasMap.set(alias, mapping.id);
      }
    }

    this.logger.debug(`Added model mapping: ${mapping.id}`);
  }

  /**
   * 获取所有模型
   */
  getAllModels(): ModelInfo[] {
    return Array.from(this.mappings.values()).map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      type: m.type,
      capability: m.capability,
      pricing: m.pricing,
      status: 'available',
    }));
  }

  /**
   * 根据提供商获取模型
   */
  getModelsByProvider(provider: string): ModelInfo[] {
    return Array.from(this.mappings.values())
      .filter(m => m.provider === provider)
      .map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        type: m.type,
        capability: m.capability,
        pricing: m.pricing,
        status: 'available',
      }));
  }

  /**
   * 初始化默认模型映射
   */
  private initializeMappings() {
    // OpenAI 模型
    this.addMapping({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      type: 'chat',
      capability: {
        chat: true,
        streaming: true,
        function_calling: true,
        vision: true,
        embeddings: false,
        images: false,
        json_mode: true,
        max_tokens: 128000,
        context_window: 128000,
      },
      pricing: { input: 5, output: 15 },
      aliases: ['gpt4o', 'gpt-4 Omni'],
    });

    this.addMapping({
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      type: 'chat',
      capability: {
        chat: true,
        streaming: true,
        function_calling: true,
        vision: true,
        embeddings: false,
        images: false,
        json_mode: true,
        max_tokens: 128000,
        context_window: 128000,
      },
      pricing: { input: 0.15, output: 0.6 },
      aliases: ['gpt4o-mini', 'gpt-4-mini'],
    });

    this.addMapping({
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      type: 'chat',
      capability: {
        chat: true,
        streaming: true,
        function_calling: true,
        vision: true,
        embeddings: false,
        images: false,
        json_mode: true,
        max_tokens: 128000,
        context_window: 128000,
      },
      pricing: { input: 10, output: 30 },
      aliases: ['gpt4-turbo', 'gpt-4-turbo-preview'],
    });

    // Anthropic 模型
    this.addMapping({
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      type: 'chat',
      capability: {
        chat: true,
        streaming: true,
        function_calling: true,
        vision: true,
        embeddings: false,
        images: false,
        json_mode: true,
        max_tokens: 200000,
        context_window: 200000,
      },
      pricing: { input: 3, output: 15 },
      aliases: ['claude-3.5-sonnet', 'claude-35-sonnet'],
    });

    this.addMapping({
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      type: 'chat',
      capability: {
        chat: true,
        streaming: true,
        function_calling: true,
        vision: true,
        embeddings: false,
        images: false,
        json_mode: true,
        max_tokens: 200000,
        context_window: 200000,
      },
      pricing: { input: 15, output: 75 },
      aliases: ['claude-opus', 'claude3-opus'],
    });

    // TODO: 添加更多模型映射
    // TODO: 支持从配置文件或数据库加载
  }

  // TODO: 支持模型别名热更新
  // TODO: 支持模型推荐
}
