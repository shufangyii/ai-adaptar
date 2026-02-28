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
 * 阿里通义千问提供商适配器
 *
 * 通义千问 API 文档: https://help.aliyun.com/zh/dashscope/developer-reference/api-details
 * 兼容 OpenAI 接口: https://dashscope.aliyuncs.com/compatible-mode/v1
 */
@Injectable()
export class QwenAdapter implements AIProvider {
  readonly name = 'qwen';
  private client: OpenAI | null = null;
  private config: ProviderConfig | null = null;
  private readonly logger = new Logger();

  constructor() {
    this.logger.setContext(QwenAdapter.name);
  }

  // 通义千问默认 API endpoint
  private readonly defaultBaseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || this.defaultBaseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      defaultHeaders: {
        ...config.additionalHeaders,
        'X-DashScope-SSE': 'enable', // 启用 SSE 流式传输
      },
    });

    this.logger.log('Qwen adapter initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // 通义千问兼容 OpenAI 的模型列表接口
      // 但更可靠的方式是发送一个简单的测试请求
      const response = await this.client.chat.completions.create({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return response.choices.length > 0;
    } catch (error: any) {
      // 401 表示 API key 无效，服务本身是可用的
      if (error?.status === 401) {
        this.logger.warn('Qwen API key invalid, but service is reachable');
        return true;
      }
      this.logger.error('Qwen health check failed:', error);
      return false;
    }
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('Qwen adapter not initialized');
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
        // 通义千问特有参数
        enable_search: false, // 是否启用联网搜索
        incremental_output: false, // 是否增量输出
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
          // 通义千问可能返回额外的 token 信息
          prompt_tokens_details: response.usage?.prompt_tokens_details,
          completion_tokens_details: response.usage?.completion_tokens_details,
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
      throw new Error('Qwen adapter not initialized');
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
      throw new Error('Qwen adapter not initialized');
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
    // 通义万相 (Wanxiang) API 使用不同的 endpoint
    // 需要使用专门的 HTTP 客户端调用
    // TODO: 实现通义万相 API 调用
    // API 文档: https://help.aliyun.com/zh/dashscope/developer-reference/wanxiang-api-call-guide

    throw new Error('Qwen image generation via Wanxiang API not implemented yet. Please use OpenAI for image generation.');
  }

  async editImage(_request: ImageEditRequest): Promise<ImageGenerationResponse> {
    // 通义万相支持图像编辑
    throw new Error('Qwen image editing not implemented yet. Please use OpenAI for image editing.');
  }

  async createImageVariation(_request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    // 通义万相支持图像变体
    throw new Error('Qwen image variation not implemented yet. Please use OpenAI for image variation.');
  }

  getSupportedModels(): string[] {
    return [
      // 通义千问大模型系列
      'qwen-max',
      'qwen-max-longcontext',
      'qwen-plus',
      'qwen-turbo',
      'qwen-turbo-latest',
      'qwen-plus-latest',
      'qwen-max-latest',

      // 通义千问开源模型 (通过灵积平台)
      'qwen-72b-chat',
      'qwen-14b-chat',
      'qwen-7b-chat',
      'qwen-1.8b-chat',

      // 嵌入模型
      'text-embedding-v1',
      'text-embedding-v2',
      'text-embedding-v3',

      // 代码模型
      'qwen-coder-plus',
      'qwen-coder-turbo',
    ];
  }

  async cleanup(): Promise<void> {
    this.client = null;
    this.config = null;
    this.logger.log('Qwen adapter cleaned up');
  }
}
