import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
 * Google Gemini 提供商适配器
 *
 * Gemini API 文档: https://ai.google.dev/docs
 *
 * Gemini 1.5 Pro - 最新的高性能模型，支持 1M token 上下文
 * Gemini 1.5 Flash - 快速响应模型
 * Gemini Pro - 通用模型
 */
@Injectable()
export class GeminiAdapter implements AIProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI | null = null;
  private config: ProviderConfig | null = null;
  private readonly logger = new Logger();

  constructor() {
    this.logger.setContext(GeminiAdapter.name);
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.logger.log('Gemini adapter initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // 发送一个简单的测试请求
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent('ping');
      return result.response !== undefined;
    } catch (error: any) {
      // 检查是否是 API key 问题
      if (error?.message?.includes('API key')) {
        this.logger.warn('Gemini API key invalid, but service is reachable');
        return true;
      }
      this.logger.error('Gemini health check failed:', error);
      return false;
    }
  }

  /**
   * 将通用消息格式转换为 Gemini 格式
   */
  private convertMessagesToGemini(messages: ChatMessage[]): Array<{
    role: string;
    parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
  }> {
    const result: Array<{
      role: string;
      parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
    }> = [];

    for (const msg of messages) {
      // Gemini 不支持 system 角色，需要转换为用户消息
      const role = msg.role === MessageRole.ASSISTANT ? 'model' : 'user';

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'text') {
            parts.push({ text: item.text || '' });
          } else if (item.type === 'image_url') {
            // Gemini 需要图片的 base64 数据和 mimeType
            const url = item.image_url?.url || '';
            if (url.startsWith('data:')) {
              const [mimeType, base64Data] = url.split(',');
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType.replace('data:', '').replace(';base64', ''),
                },
              });
            }
          }
        }
      }

      result.push({ role, parts });
    }

    return result;
  }

  /**
   * 从消息中提取 system 指令
   */
  private extractSystemInstruction(messages: ChatMessage[]): string | undefined {
    const systemMsgs = messages.filter(m => m.role === MessageRole.SYSTEM);
    if (systemMsgs.length > 0) {
      return systemMsgs.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
    }
    return undefined;
  }

  /**
   * 将 Gemini 响应转换为通用格式
   */
  private convertGeminiResponseToStandard(
    response: any,
    model: string,
    requestId: string,
  ): ChatCompletionResponse {
    const candidates = response.response?.candidates || [];
    const usage = response.response?.usageMetadata || {};

    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      provider: this.name,
      choices: candidates.map((candidate: any, index: number) => ({
        index,
        message: {
          role: 'assistant' as MessageRole.ASSISTANT,
          content: candidate.content?.parts?.[0]?.text || '',
        },
        logprobs: null,
        finish_reason: candidate.finishReason === 'STOP' ? 'stop' : 'length',
      })),
      usage: {
        prompt_tokens: usage.promptTokenCount || 0,
        completion_tokens: usage.candidatesTokenCount || 0,
        total_tokens: usage.totalTokenCount || 0,
      },
    };
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('Gemini adapter not initialized');
    }

    try {
      const systemInstruction = this.extractSystemInstruction(request.messages);
      const userMessages = request.messages.filter(m => m.role !== MessageRole.SYSTEM);

      const model = this.client.getGenerativeModel({
        model: request.model,
        systemInstruction,
      });

      const GeminiHistory = this.convertMessagesToGemini(userMessages.slice(0, -1));
      const lastMessage = this.convertMessagesToGemini([userMessages[userMessages.length - 1]!])[0];

      const chat = model.startChat({
        history: GeminiHistory,
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          topK: undefined,
          maxOutputTokens: request.max_tokens,
          stopSequences: Array.isArray(request.stop) ? request.stop : undefined,
        },
      });

      const result = await chat.sendMessage(lastMessage.parts[0]?.text || '');
      const response = await result.response;

      return {
        id: `gemini_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        provider: this.name,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as MessageRole.ASSISTANT,
              content: response.text(),
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata?.totalTokenCount || 0,
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
      throw new Error('Gemini adapter not initialized');
    }

    try {
      const systemInstruction = this.extractSystemInstruction(request.messages);
      const userMessages = request.messages.filter(m => m.role !== MessageRole.SYSTEM);

      const model = this.client.getGenerativeModel({
        model: request.model,
        systemInstruction,
      });

      const GeminiHistory = this.convertMessagesToGemini(userMessages.slice(0, -1));
      const lastMessage = this.convertMessagesToGemini([userMessages[userMessages.length - 1]!])[0];

      const chat = model.startChat({
        history: GeminiHistory,
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          maxOutputTokens: request.max_tokens,
          stopSequences: Array.isArray(request.stop) ? request.stop : undefined,
        },
      });

      const result = await chat.sendMessageStream(lastMessage.parts[0]?.text || '');
      const eventId = `gemini_${Date.now()}`;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            id: eventId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            provider: this.name,
            choices: [
              {
                index: 0,
                delta: { content: text },
                logprobs: null,
                finish_reason: null,
              },
            ],
          };
        }
      }

      // 发送结束标记
      yield {
        id: eventId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        provider: this.name,
        choices: [
          {
            index: 0,
            delta: {},
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
      };
    } catch (error) {
      this.logger.error('Error creating stream chat completion:', error);
      throw error;
    }
  }

  async createEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.client) {
      throw new Error('Gemini adapter not initialized');
    }

    try {
      const model = this.client.getGenerativeModel({ model: request.model });

      const inputs = Array.isArray(request.input) ? request.input : [request.input];
      const embeddings: any[] = [];

      for (const input of inputs) {
        const result = await model.embedContent(input);
        embeddings.push({
          object: 'embedding',
          embedding: result.embedding.values,
          index: embeddings.length,
        });
      }

      return {
        object: 'list',
        data: embeddings,
        model: request.model,
        provider: this.name,
        usage: {
          prompt_tokens: 0, // Gemini 不返回 token 数
          total_tokens: 0,
        },
      };
    } catch (error) {
      this.logger.error('Error creating embeddings:', error);
      throw error;
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    // Google Imagen API 使用不同的 endpoint
    // 需要使用 Vertex AI 或 Imagen API
    throw new Error('Gemini image generation via Imagen API not implemented yet. Please use OpenAI for image generation.');
  }

  async editImage(_request: ImageEditRequest): Promise<ImageGenerationResponse> {
    throw new Error('Gemini does not support image editing. Please use OpenAI for image editing.');
  }

  async createImageVariation(_request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    throw new Error('Gemini does not support image variation. Please use OpenAI for image variation.');
  }

  getSupportedModels(): string[] {
    return [
      // Gemini 1.5 系列
      'gemini-1.5-pro',
      'gemini-1.5-pro-001',
      'gemini-1.5-flash',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-8b',

      // Gemini 1.0 系列
      'gemini-pro',
      'gemini-pro-vision',

      // 嵌入模型
      'text-embedding-004',
      'multimodalembedding',

      // 简化别名
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
    ];
  }

  async cleanup(): Promise<void> {
    this.client = null;
    this.config = null;
    this.logger.log('Gemini adapter cleaned up');
  }
}
