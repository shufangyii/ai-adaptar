import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
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
import { Logger, generateId } from '@ai-adaptar/common';

/**
 * OpenAI 提供商适配器
 */
@Injectable()
export class OpenAIAdapter implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI | null = null;
  private config: ProviderConfig | null = null;
  private readonly logger = new Logger(OpenAIAdapter.name);

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      defaultHeaders: config.additionalHeaders,
    });

    this.logger.log('OpenAI adapter initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // 简单的健康检查：列出模型
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('OpenAI adapter not initialized');
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
      });

      return {
        id: response.id,
        object: response.object as 'chat.completion',
        created: response.created,
        model: response.model,
        provider: this.name,
        choices: response.choices.map(c => ({
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
      throw new Error('OpenAI adapter not initialized');
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
          choices: chunk.choices.map(c => ({
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
      throw new Error('OpenAI adapter not initialized');
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
        data: response.data.map(d => ({
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
      throw new Error('OpenAI adapter not initialized');
    }

    try {
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
        data: response.data.map(d => ({
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

  async editImage(request: ImageEditRequest): Promise<ImageGenerationResponse> {
    if (!this.client) {
      throw new Error('OpenAI adapter not initialized');
    }

    try {
      // OpenAI 图像编辑需要文件数据
      // 支持两种格式：base64 或文件路径
      const imageFile = this.parseImageData(request.image);
      const maskFile = request.mask ? this.parseImageData(request.mask) : undefined;

      const response = await this.client.images.edit({
        image: imageFile,
        mask: maskFile,
        prompt: request.prompt,
        model: request.model as any,
        n: request.n,
        size: request.size,
        response_format: request.response_format,
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
      this.logger.error('Error editing image:', error);
      throw error;
    }
  }

  async createImageVariation(request: ImageVariationRequest): Promise<ImageGenerationResponse> {
    if (!this.client) {
      throw new Error('OpenAI adapter not initialized');
    }

    try {
      // OpenAI 图像变体需要文件数据
      const imageFile = this.parseImageData(request.image);

      const response = await this.client.images.createVariation({
        image: imageFile,
        model: request.model as any,
        n: request.n,
        size: request.size,
        response_format: request.response_format,
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
      this.logger.error('Error creating image variation:', error);
      throw error;
    }
  }

  /**
   * 解析图像数据
   * 支持 base64 ���符串或文件路径
   */
  private parseImageData(image: string): any {
    // 如果是 base64 字符串
    if (image.startsWith('data:')) {
      // OpenAI SDK 需要 Buffer 或 File 对象
      const [, base64Data] = image.split(',');
      return Buffer.from(base64Data, 'base64');
    }

    // 如果是 URL
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image; // OpenAI SDK 可能支持 URL
    }

    // 假设是文件路径
    return image;
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
      'dall-e-3',
      'dall-e-2',
    ];
  }

  async cleanup(): Promise<void> {
    this.client = null;
    this.config = null;
    this.logger.log('OpenAI adapter cleaned up');
  }
}
