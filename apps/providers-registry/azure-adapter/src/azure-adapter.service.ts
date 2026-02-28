import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  AIProvider,
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageEditRequest,
  ImageVariationRequest,
} from '@ai-adaptar/interfaces';
import { Logger } from '@ai-adaptar/common';

/**
 * Azure OpenAI 提供商适配器
 *
 * Azure OpenAI API 文档: https://learn.microsoft.com/en-us/azure/ai-services/openai/
 *
 * 配置说明：
 * - baseURL: https://{your-resource-name}.openai.azure.com/openai/deployments/{deployment-id}
 * - apiKey: Azure OpenAI API key
 * - apiVersion: API version (默认: 2024-02-15-preview)
 *
 * 部署说明：
 * 在 Azure OpenAI 中，模型是通过部署名称访问的，不是模型名称
 * 每个部署都有一个唯一的部署名称和对应的模型
 */
@Injectable()
export class AzureAdapter implements AIProvider {
  readonly name = 'azure';
  private client: OpenAI | null = null;
  private config: ProviderConfig | null = null;
  private readonly logger = new Logger();

  // Azure OpenAI 默认 API version
  private readonly defaultApiVersion = '2024-02-15-preview';

  constructor() {
    this.logger.setContext(AzureAdapter.name);
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;

    // Azure OpenAI 使用额外的查询参数 api-version
    const baseURL = config.baseURL || '';
    const apiVersion = config.additionalHeaders?.['api-version'] || this.defaultApiVersion;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: `${baseURL}?api-version=${apiVersion}`,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      defaultHeaders: {
        ...config.additionalHeaders,
        'api-key': config.apiKey,
      },
      // Azure OpenAI 需要这些配置
      dangerouslyAllowBrowser: false,
    });

    this.logger.log('Azure OpenAI adapter initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // 发送一个简单的测试请求
      const response = await this.client.chat.completions.create({
        model: 'gpt-35-turbo', // Azure 中的通用模型名称
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return response.choices.length > 0;
    } catch (error: any) {
      // 401 表示 API key 无效，服务本身是可用的
      if (error?.status === 401) {
        this.logger.warn('Azure OpenAI API key invalid, but service is reachable');
        return true;
      }
      this.logger.error('Azure OpenAI health check failed:', error);
      return false;
    }
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        messages: request.messages as any,
        model: request.model,
        frequency_penalty: request.frequency_penalty,
        logit_bias: request.logit_bias,
        logprobs: request.logprobs,
        top_logprobs: request.top_logprobs,
        max_tokens: request.max_tokens,
        n: request.n,
        presence_penalty: request.presence_penalty,
        response_format: request.response_format as any,
        seed: request.seed,
        stop: request.stop,
        stream: false,
        temperature: request.temperature,
        top_p: request.top_p,
        tools: request.tools as any,
        tool_choice: request.tool_choice as any,
        user: request.user,
        // Azure OpenAI 特有参数
        enhancments: 'auto', // 数据增强
      });

      return {
        id: response.id,
        object: response.object as 'chat.completion',
        created: response.created,
        model: response.model,
        provider: this.name,
        choices: response.choices.map((c: any) => ({
          index: c.index,
          message: c.message as any,
          logprobs: c.logprobs as any,
          finish_reason: c.finish_reason as any,
        })),
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.error('Error creating chat completion:', error);
      throw error;
    }
  }

  async *createStreamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncIterable<StreamChunk> {
    if (!this.client) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    try {
      const stream = await this.client.chat.completions.create({
        messages: request.messages as any,
        model: request.model,
        frequency_penalty: request.frequency_penalty,
        logit_bias: request.logit_bias,
        max_tokens: request.max_tokens,
        n: request.n,
        presence_penalty: request.presence_penalty,
        response_format: request.response_format as any,
        stop: request.stop,
        stream: true,
        temperature: request.temperature,
        top_p: request.top_p,
        tools: request.tools as any,
        tool_choice: request.tool_choice as any,
        user: request.user,
      });

      for await (const chunk of stream) {
        yield {
          id: chunk.id,
          object: 'chat.completion.chunk',
          created: chunk.created,
          model: chunk.model,
          provider: this.name,
          choices: chunk.choices.map((c: any) => ({
            index: c.index,
            delta: c.delta as any,
            logprobs: c.logprobs as any,
            finish_reason: c.finish_reason as any,
          })),
        };
      }
    } catch (error) {
      this.logger.error('Error creating stream chat completion:', error);
      throw error;
    }
  }

  async createEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.client) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    try {
      const response = await this.client.embeddings.create({
        input: request.input,
        model: request.model,
        encoding_format: request.encoding_format,
        dimensions: request.dimensions,
        user: request.user,
      });

      return {
        object: 'list',
        data: response.data.map((d: any) => ({
          index: d.index,
          object: 'embedding',
          embedding: d.embedding,
        })),
        model: response.model,
        provider: this.name,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.error('Error creating embeddings:', error);
      throw error;
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.client) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    try {
      // Azure OpenAI 支持 DALL-E 图像生成
      const response = await this.client.images.generate({
        prompt: request.prompt,
        model: request.model as any,
        n: request.n,
        size: request.size,
        quality: request.quality,
        style: request.style,
        response_format: request.response_format,
        user: request.user,
      });

      return {
        created: Date.now(),
        data: response.data.map((d: any) => ({
          url: d.url,
          b64_json: d.b64_json,
          revised_prompt: d.revised_prompt,
        })),
        provider: this.name,
        model: request.model,
      };
    } catch (error) {
      this.logger.error('Error generating image:', error);
      throw error;
    }
  }

  async editImage(_request: ImageEditRequest): Promise<ImageGenerationResponse> {
    // Azure OpenAI 支持 DALL-E 图像编辑
    throw new Error('Azure OpenAI image editing not implemented yet. Please use OpenAI for image editing.');
  }

  async createImageVariation(_request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    // Azure OpenAI 支持 DALL-E 图像变体
    throw new Error('Azure OpenAI image variation not implemented yet. Please use OpenAI for image variation.');
  }

  getSupportedModels(): string[] {
    // Azure OpenAI 中的模型是以部署名称的形式存在的
    // 这些是常见的部署名称，实际使用时需要在 Azure 中创建对应的部署
    return [
      // GPT-4 系列
      'gpt-4',
      'gpt-4-32k',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',

      // GPT-3.5 系列
      'gpt-35-turbo',
      'gpt-35-turbo-16k',

      // 嵌入模型
      'text-embedding-ada-002',
      'text-embedding-3-small',
      'text-embedding-3-large',

      // 图像生成
      'dall-e-3',
      'dall-e-2',

      // 注意：实际可用的模型取决于在 Azure OpenAI 中创建的部署
      // 部署名称可以自定义，不一定与上述名称相同
    ];
  }

  async cleanup(): Promise<void> {
    this.client = null;
    this.config = null;
    this.logger.log('Azure OpenAI adapter cleaned up');
  }
}
