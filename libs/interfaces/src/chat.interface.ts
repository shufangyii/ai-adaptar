/**
 * 聊天消息角色
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
  TOOL = 'tool',
}

/**
 * 消息内容类型
 */
export interface Content {
  type: 'text' | 'image_url' | 'audio';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
  audio?: { data: string; format?: string };
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: MessageRole;
  content: string | Content[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * 函数调用
 */
export interface FunctionCall {
  name: string;
  arguments: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

/**
 * 函数定义
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: object;
  strict?: boolean;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

/**
 * 聊天补全���求
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  provider?: string; // 指定提供商 (可选)
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  logprobs?: boolean;
  top_logprobs?: number;
  max_tokens?: number;
  n?: number;
  presence_penalty?: number;
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
  stop?: string | string[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function', function: { name: string } };
  user?: string;
  // TODO: 添加重试策略配置
  // TODO: 添加缓存策略配置
}

/**
 * 日志概率
 */
export interface LogProb {
  token: string;
  logprob: number;
  bytes?: number[];
  top_logprobs?: Array<{ token: string; logprob: number; bytes?: number[] }>;
}

/**
 * 聊天补全选择
 */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  logprobs: { content: LogProb[] } | null;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
}

/**
 * 使用统计
 */
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: { cached_tokens: number; audio_tokens: number };
  completion_tokens_details?: { reasoning_tokens: number; audio_tokens: number; accepted_prediction_tokens: number; rejected_prediction_tokens: number };
}

/**
 * 聊天补全响应
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  provider: string;
  choices: ChatCompletionChoice[];
  usage: UsageStats;
  system_fingerprint?: string;
}

/**
 * 流式响应数据块
 */
export interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  provider: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    logprobs: { content: LogProb[] } | null;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | null;
  }>;
}

// TODO: 添加批量请求/响应接口
// TODO: 添加对话历史管理接口
// TODO: 添加上下文窗口管理接口

/**
 * 函数调用执行结果
 */
export interface FunctionExecutionResult {
  name: string;
  arguments: Record<string, any>;
  result: any;
  error?: string;
}

/**
 * 函数调用选项
 */
export interface FunctionCallOptions {
  /**
   * 是否自动执行函数调用
   * @default true
   */
  autoExecute?: boolean;

  /**
   * 最大函数调用轮数（防止无限循环）
   * @default 5
   */
  maxIterations?: number;

  /**
   * 函数调用超时时间（毫秒）
   * @default 30000
   */
  timeout?: number;

  /**
   * 是否并行执行多个函数调用
   * @default false
   */
  parallel?: boolean;
}

/**
 * 函数定义注册表
 */
export interface FunctionRegistry {
  /**
   * 注册函数
   */
  register(name: string, definition: FunctionDefinition, handler: FunctionHandler): void;

  /**
   * 批量注册函数
   */
  registerBatch(functions: Record<string, { definition: FunctionDefinition; handler: FunctionHandler }>): void;

  /**
   * 获取函数定义
   */
  get(name: string): FunctionDefinition | undefined;

  /**
   * 获取所有函数定义
   */
  getAll(): Record<string, FunctionDefinition>;

  /**
   * 执行函数
   */
  execute(name: string, args: Record<string, any>): Promise<any>;

  /**
   * 注销函数
   */
  unregister(name: string): boolean;

  /**
   * 检查函数是否存在
   */
  has(name: string): boolean;
}

/**
 * 函数处理器
 */
export type FunctionHandler = (args: Record<string, any>, context: FunctionContext) => Promise<any> | any;

/**
 * 函数调用上下文
 */
export interface FunctionContext {
  /**
   * 用户 ID
   */
  userId: string;

  /**
   * 请求 ID
   */
  requestId: string;

  /**
   * 模型名称
   */
  model: string;

  /**
   * 提供商名称
   */
  provider: string;

  /**
   * 额外的元数据
   */
  metadata?: Record<string, any>;
}
