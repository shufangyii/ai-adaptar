import { Injectable, Logger } from '@nestjs/common';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ToolCall,
  FunctionExecutionResult,
  FunctionCallOptions,
  ChatMessage,
  MessageRole,
} from '@ai-adaptar/interfaces';
import { FunctionRegistryService } from './function-registry.service';
import { ProviderManager } from '../providers/provider-manager.service';
import { LoadBalancer } from '../load-balancer/load-balancer.service';

/**
 * 函数调用执行器
 * 处理函数调用的完整生命周期
 */
@Injectable()
export class FunctionExecutorService {
  private readonly logger = new Logger(FunctionExecutorService.name);

  private readonly defaultOptions: Required<FunctionCallOptions> = {
    autoExecute: true,
    maxIterations: 5,
    timeout: 30000,
    parallel: false,
  };

  constructor(
    private readonly functionRegistry: FunctionRegistryService,
    private readonly providerManager: ProviderManager,
    private readonly loadBalancer: LoadBalancer,
  ) {}

  /**
   * 执行带函数调用的聊天补全
   */
  async executeWithFunctions(
    request: ChatCompletionRequest,
    options?: FunctionCallOptions,
    userId?: string,
  ): Promise<ChatCompletionResponse> {
    const opts = { ...this.defaultOptions, ...options };

    if (!opts.autoExecute) {
      // 如果不自动执行，直接返回原始响应
      return this.executeChatCompletion(request);
    }

    let currentRequest = { ...request };
    const results: FunctionExecutionResult[] = [];
    let iteration = 0;

    while (iteration < opts.maxIterations) {
      iteration++;
      this.logger.debug(`Function calling iteration ${iteration}/${opts.maxIterations}`);

      // 执行聊天补全
      const response = await this.executeChatCompletion(currentRequest);

      // 检查是否有工具调用
      const toolCalls = this.extractToolCalls(response);

      if (toolCalls.length === 0) {
        this.logger.debug('No more tool calls, returning response');
        return response;
      }

      // 执行工具调用
      const executionResults = await this.executeToolCalls(
        toolCalls,
        response,
        userId,
      );

      results.push(...executionResults);

      // 准备下一轮请求
      currentRequest = this.prepareNextRequest(currentRequest, response, executionResults);
    }

    throw new Error(`Max iterations (${opts.maxIterations}) reached for function calling`);
  }

  /**
   * 执行流式聊天补全（不支持自动函数调用）
   */
  async *executeStreamWithFunctions(
    request: ChatCompletionRequest,
  ): AsyncGenerator<any, ChatCompletionResponse, any> {
    // 流式响应不支持自动函数调用，直接返回流
    const provider = await this.loadBalancer.selectProvider(request.model, request.provider);
    yield* provider.createStreamChatCompletion(request);
  }

  /**
   * 执行聊天补全
   */
  private async executeChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const provider = await this.loadBalancer.selectProvider(request.model, request.provider);
    return provider.createChatCompletion(request);
  }

  /**
   * 从响应中提取工具调用
   */
  private extractToolCalls(response: ChatCompletionResponse): ToolCall[] {
    const calls: ToolCall[] = [];

    for (const choice of response.choices) {
      if (choice.message.tool_calls) {
        calls.push(...choice.message.tool_calls);
      }
    }

    return calls;
  }

  /**
   * 执行工具调用
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    response: ChatCompletionResponse,
    userId?: string,
  ): Promise<FunctionExecutionResult[]> {
    const results: FunctionExecutionResult[] = [];

    const context = {
      userId: userId || 'default',
      requestId: response.id,
      model: response.model,
      provider: response.provider,
    };

    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall.function;

      try {
        // 解析参数
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

        // 执行函数
        const result = await this.executeWithTimeout(
          name,
          parsedArgs,
          context,
        );

        results.push({
          name,
          arguments: parsedArgs,
          result,
        });

        this.logger.debug(`Tool call ${name} executed successfully`);
      } catch (error) {
        this.logger.error(`Error executing tool call ${name}:`, error);
        results.push({
          name,
          arguments: typeof args === 'string' ? JSON.parse(args) : args,
          result: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 带超时的函数执行
   */
  private async executeWithTimeout(
    name: string,
    args: Record<string, any>,
    context: any,
    timeout: number = 30000,
  ): Promise<any> {
    return Promise.race([
      this.functionRegistry.execute(name, args, context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Function ${name} execution timeout`)), timeout),
      ),
    ]);
  }

  /**
   * 准备下一轮请求
   */
  private prepareNextRequest(
    originalRequest: ChatCompletionRequest,
    response: ChatCompletionResponse,
    results: FunctionExecutionResult[],
  ): ChatCompletionRequest {
    const assistantMessage = this.createAssistantMessage(response);
    const toolMessages = this.createToolMessages(results);

    return {
      ...originalRequest,
      messages: [...originalRequest.messages, assistantMessage, ...toolMessages],
    };
  }

  /**
   * 创建助手消息
   */
  private createAssistantMessage(response: ChatCompletionResponse): ChatMessage {
    const choice = response.choices[0];
    return {
      role: MessageRole.ASSISTANT,
      content: choice.message.content || '',
      tool_calls: choice.message.tool_calls,
    };
  }

  /**
   * 创建工具消息
   */
  private createToolMessages(results: FunctionExecutionResult[]): ChatMessage[] {
    return results.map(result => ({
      role: MessageRole.TOOL,
      content: JSON.stringify(result.result),
      tool_call_id: result.name, // 简化处理，实际应该从 tool_call 获取 id
      name: result.name,
    }));
  }

  /**
   * 获取可用的工具定义列表
   */
  getAvailableTools(): { name: string; definition: any }[] {
    const allFunctions = this.functionRegistry.getAll();
    return Object.entries(allFunctions).map(([name, definition]) => ({
      name,
      definition: {
        type: 'function',
        function: definition,
      },
    }));
  }
}
