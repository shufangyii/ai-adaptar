import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
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
  MessageRole,
  ChatMessage,
} from '@ai-adaptar/interfaces';
import { Logger } from '@ai-adaptar/common';

/**
 * Anthropic 提供商适配器
 *
 * Anthropic API 文档: https://docs.anthropic.com/claude/reference/messages
 *
 * Claude 3.5 Sonnet - 最新的高性能模型
 * Claude 3 Opus - 最强能力模型
 * Claude 3 Sonnet - 平衡性能和成本
 * Claude 3 Haiku - 最快最经济的模型
 */
@Injectable()
export class AnthropicAdapter implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;
  private config: ProviderConfig | null = null;
  private readonly logger = new Logger();

  constructor() {
    this.logger.setContext(AnthropicAdapter.name);
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      defaultHeaders: config.additionalHeaders,
    });

    this.logger.log('Anthropic adapter initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // 发送一个简单的测试请求
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return response.content.length > 0;
    } catch (error: any) {
      // 401 表示 API key 无效
      if (error?.status === 401) {
        this.logger.warn('Anthropic API key invalid, but service is reachable');
        return true;
      }
      this.logger.error('Anthropic health check failed:', error);
      return false;
    }
  }

  /**
   * 将通用消息格式转换为 Anthropic 格式
   */
  private convertMessagesToAnthropic(messages: ChatMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      if (msg.role === MessageRole.SYSTEM) {
        // Anthropic 的 system 消息是单独处理的，不在这里转换
        throw new Error('System messages should be handled separately');
      }

      const anthropicMsg: Anthropic.MessageParam = {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: '',
      };

      // 处理不同类型的内容
      if (typeof msg.content === 'string') {
        anthropicMsg.content = msg.content;
      } else if (Array.isArray(msg.content)) {
        // 转换为 Anthropic 内容格式
        anthropicMsg.content = msg.content.map((item) => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text || '' };
          } else if (item.type === 'image_url') {
            return {
              type: 'image',
              source: {
                type: 'url',
                url: item.image_url?.url || '',
              },
            };
          }
          return { type: 'text', text: '' };
        });
      }

      return anthropicMsg;
    });
  }

  /**
   * 从消息中提取 system 消息
   */
  private extractSystemMessage(messages: ChatMessage[]): string | undefined {
    const systemMsg = messages.find(m => m.role === MessageRole.SYSTEM);
    if (systemMsg && typeof systemMsg.content === 'string') {
      return systemMsg.content;
    }
    return undefined;
  }

  /**
   * 将 Anthropic 响应转换为通用格式
   */
  private convertAnthropicResponseToStandard(
    response: Anthropic.Message,
    model: string,
  ): ChatCompletionResponse {
    return {
      id: response.id,
      object: 'chat.completion',
      created: response.created_at || Math.floor(Date.now() / 1000),
      model: response.model,
      provider: this.name,
      choices: response.content.map((block, index) => ({
        index,
        message: {
          role: 'assistant' as MessageRole.ASSISTANT,
          content:
            block.type === 'text'
              ? block.text
              : JSON.stringify(block),
        },
        logprobs: null,
        finish_reason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      })),
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('Anthropic adapter not initialized');
    }

    try {
      const systemMessage = this.extractSystemMessage(request.messages);
      const userMessages = request.messages.filter(m => m.role !== MessageRole.SYSTEM);

      const response = await this.client.messages.create({
        model: request.model as Anthropic.Model,
        messages: this.convertMessagesToAnthropic(userMessages),
        system: systemMessage,
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        top_k: undefined, // Anthropic 特有参数
        stop_sequences: Array.isArray(request.stop) ? request.stop : undefined,
        stream: false,
        tools: request.tools?.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters as any,
        })),
        tool_choice: request.tool_choice as any,
      });

      return this.convertAnthropicResponseToStandard(response, request.model);
    } catch (error) {
      this.logger.error('Error creating chat completion:', error);
      throw error;
    }
  }

  async *createStreamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncIterable<StreamChunk> {
    if (!this.client) {
      throw new Error('Anthropic adapter not initialized');
    }

    try {
      const systemMessage = this.extractSystemMessage(request.messages);
      const userMessages = request.messages.filter(m => m.role !== MessageRole.SYSTEM);

      const stream = await this.client.messages.create({
        model: request.model as Anthropic.Model,
        messages: this.convertMessagesToAnthropic(userMessages),
        system: systemMessage,
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: Array.isArray(request.stop) ? request.stop : undefined,
        stream: true,
      });

      const eventId = `msg_${Date.now()}`;
      let index = 0;

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            yield {
              id: event.message.id,
              object: 'chat.completion.chunk',
              created: event.message.created_at || Math.floor(Date.now() / 1000),
              model: event.message.model,
              provider: this.name,
              choices: [
                {
                  index: 0,
                  delta: { role: 'assistant', content: '' },
                  logprobs: null,
                  finish_reason: null,
                },
              ],
            };
            break;

          case 'content_block_start':
            if (event.contentBlock?.type === 'text') {
              yield {
                id: eventId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: request.model,
                provider: this.name,
                choices: [
                  {
                    index: index++,
                    delta: { content: event.contentBlock.text || '' },
                    logprobs: null,
                    finish_reason: null,
                  },
                ],
              };
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
              yield {
                id: eventId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: request.model,
                provider: this.name,
                choices: [
                  {
                    index: index - 1,
                    delta: { content: event.delta.text },
                    logprobs: null,
                    finish_reason: null,
                  },
                ],
              };
            }
            break;

          case 'message_stop':
            yield {
              id: eventId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: request.model,
              provider: this.name,
              choices: [
                {
                  index: index - 1,
                  delta: {},
                  logprobs: null,
                  finish_reason: 'stop',
                },
              ],
            };
            break;
        }
      }
    } catch (error) {
      this.logger.error('Error creating stream chat completion:', error);
      throw error;
    }
  }

  async createEmbeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic 不提供嵌入 API，建议使用其他提供商
    throw new Error('Anthropic does not provide embeddings API. Please use OpenAI, Qwen, or other providers for embeddings.');
  }

  async generateImage(_request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // Anthropic 不提供图像生成 API，建议使用其他提供商
    throw new Error('Anthropic does not provide image generation API. Please use OpenAI, Qwen, or other providers for image generation.');
  }

  async editImage(_request: ImageEditRequest): Promise<ImageGenerationResponse> {
    throw new Error('Anthropic does not support image editing. Please use OpenAI for image editing.');
  }

  async createImageVariation(_request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    throw new Error('Anthropic does not support image variation. Please use OpenAI for image variation.');
  }

  getSupportedModels(): string[] {
    return [
      // Claude 3.5 系列
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',

      // Claude 3 系列
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',

      // 简化别名
      'claude-3-5-sonnet',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
    ];
  }

  async cleanup(): Promise<void> {
    this.client = null;
    this.config = null;
    this.logger.log('Anthropic adapter cleaned up');
  }
}
