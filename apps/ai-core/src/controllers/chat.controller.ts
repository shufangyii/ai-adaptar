import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  FunctionCallOptions,
} from '@ai-adaptar/interfaces';
import { ProviderManager } from '../providers/provider-manager.service';
import { LoadBalancer } from '../load-balancer/load-balancer.service';
import { FunctionExecutorService } from '../function-calling/function-executor.service';

/**
 * 聊天补全控制器
 * 处理 NATS 消息并路由到对应的提供商
 */
@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly loadBalancer: LoadBalancer,
    private readonly functionExecutor: FunctionExecutorService,
  ) {}

  @EventPattern('chat.completion')
  async createChatCompletion(
    @Payload() request: ChatCompletionRequest & { userId?: string; functionCallOptions?: FunctionCallOptions },
    @Ctx() context: RmqContext,
  ): Promise<ChatCompletionResponse> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Creating chat completion for model: ${request.model}`);

      // 检查是否需要函数调用
      const hasTools = request.tools && request.tools.length > 0;
      const shouldAutoExecute = request.functionCallOptions?.autoExecute !== false;

      if (hasTools && shouldAutoExecute) {
        this.logger.debug(`[${correlationId}] Executing with function calls`);
        return this.functionExecutor.executeWithFunctions(
          request,
          request.functionCallOptions,
          request.userId,
        );
      }

      // 选择提供商
      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      this.logger.debug(`[${correlationId}] Selected provider: ${provider.name}`);

      // 调用提供商
      const response = await provider.createChatCompletion(request);

      this.logger.log(`[${correlationId}] Chat completion created successfully`);

      return response;
    } catch (error) {
      this.logger.error(`[${correlationId}] Error creating chat completion:`, error);
      throw error;
    }
  }

  @EventPattern('chat.completion.stream')
  async *createStreamChatCompletion(
    @Payload() request: ChatCompletionRequest,
    @Ctx() context: RmqContext,
  ): AsyncIterable<StreamChunk> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Creating stream chat completion for model: ${request.model}`);

      // 流式响应不支持自动函数调用
      const hasTools = request.tools && request.tools.length > 0;
      if (hasTools) {
        this.logger.warn(`[${correlationId}] Function calling is not supported in stream mode`);
      }

      const provider = await this.loadBalancer.selectProvider(request.model, request.provider);

      this.logger.debug(`[${correlationId}] Selected provider: ${provider.name}`);

      yield* provider.createStreamChatCompletion(request);

      this.logger.log(`[${correlationId}] Stream chat completion finished`);
    } catch (error) {
      this.logger.error(`[${correlationId}] Error creating stream chat completion:`, error);
      throw error;
    }
  }

  /**
   * 获取可用的函数列表
   */
  @EventPattern('chat.functions.list')
  async listFunctions(@Ctx() context: RmqContext): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Listing available functions`);

      const tools = this.functionExecutor.getAvailableTools();

      return {
        object: 'list',
        data: tools,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error listing functions:`, error);
      throw error;
    }
  }

  /**
   * 注册自定义函数
   */
  @EventPattern('chat.functions.register')
  async registerFunction(
    @Payload() data: {
      name: string;
      definition: any;
      handler?: string; // handler name reference
    },
    @Ctx() context: RmqContext,
  ): Promise<any> {
    const correlationId = this.getCorrelationId(context);

    try {
      this.logger.log(`[${correlationId}] Registering function: ${data.name}`);

      // TODO: 实现动态函数注册
      // 这里需要处理远程函数注册的逻辑

      return {
        success: true,
        function: data.name,
      };
    } catch (error) {
      this.logger.error(`[${correlationId}] Error registering function:`, error);
      throw error;
    }
  }

  private getCorrelationId(context: RmqContext): string {
    const message = context.getMessage();
    return message.properties?.correlationId || 'unknown';
  }
}
