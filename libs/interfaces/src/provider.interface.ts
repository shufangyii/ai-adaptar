import { ChatCompletionRequest, ChatCompletionResponse, StreamChunk } from './chat.interface';
import { EmbeddingRequest, EmbeddingResponse } from './embeddings.interface';
import { ImageGenerationRequest, ImageGenerationResponse, ImageEditRequest, ImageVariationRequest } from './images.interface';

/**
 * 提供商基础配置
 */
export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  additionalHeaders?: Record<string, string>;
}

/**
 * AI 提供商接口
 * 所有提供商适配器必须实现此接口
 */
export interface AIProvider {
  /**
   * 提供商名称
   */
  readonly name: string;

  /**
   * 初始化提供商
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;

  /**
   * 创建聊天补全
   */
  createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * 创建流式聊天补全
   */
  createStreamChatCompletion(request: ChatCompletionRequest): AsyncIterable<StreamChunk>;

  /**
   * 创建嵌��向量
   */
  createEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * 生成图像
   */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /**
   * 编辑图像
   */
  editImage(request: ImageEditRequest): Promise<ImageGenerationResponse>;

  /**
   * 创建图像变体
   */
  createImageVariation(request: ImageVariationRequest): Promise<ImageGenerationResponse>;

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[];

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * 提供商工厂接口
 */
export interface ProviderFactory {
  /**
   * 创建提供商实例
   */
  createProvider(name: string, config: ProviderConfig): AIProvider;

  /**
   * 注册新的提供商
   */
  registerProvider(name: string, providerClass: new () => AIProvider): void;
}

// TODO: 添加提供商健康检查详情接口
// TODO: 添加提供商错误标准化接口
