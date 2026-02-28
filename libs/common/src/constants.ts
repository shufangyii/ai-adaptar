/**
 * 提供商常量
 */
export const Providers = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  AZURE: 'azure',
  GEMINI: 'gemini',
  QWEN: 'qwen',
  // TODO: 添加更多提供商
} as const;

/**
 * 模型常量
 */
export const Models = {
  // OpenAI
  GPT4: 'gpt-4',
  GPT4_TURBO: 'gpt-4-turbo',
  GPT35_TURBO: 'gpt-3.5-turbo',
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',

  // Anthropic
  CLAUDE_3_OPUS: 'claude-3-opus',
  CLAUDE_3_SONNET: 'claude-3-sonnet',
  CLAUDE_3_HAIKU: 'claude-3-haiku',
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet',

  // Google
  GEMINI_PRO: 'gemini-pro',
  GEMINI_ULTRA: 'gemini-ultra',

  // 阿里
  QWEN_TURBO: 'qwen-turbo',
  QWEN_PLUS: 'qwen-plus',
  QWEN_MAX: 'qwen-max',
} as const;

/**
 * NATS 消息命令
 */
export const NatsCommands = {
  // 聊天
  CHAT_COMPLETION: 'chat.completion',
  CHAT_COMPLETION_STREAM: 'chat.completion.stream',

  // 嵌入
  EMBEDDINGS_CREATE: 'embeddings.create',

  // 图像
  IMAGE_GENERATE: 'image.generate',
  IMAGE_EDIT: 'image.edit',
  IMAGE_VARIATION: 'image.variation',

  // 模型
  MODELS_LIST: 'models.list',
  MODELS_GET: 'models.get',

  // 计费
  BILLING_USAGE: 'billing.usage',
  BILLING_USAGE_PERIOD: 'billing.usage.period',
  BILLING_QUOTA_CHECK: 'billing.quota.check',
  // TODO: 添加更多命令
} as const;

/**
 * 环境变量键
 */
export const EnvKeys = {
  NATS_URL: 'NATS_URL',
  NATS_USER: 'NATS_USER',
  NATS_PASS: 'NATS_PASS',

  // API Keys
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  AZURE_API_KEY: 'AZURE_API_KEY',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  QWEN_API_KEY: 'QWEN_API_KEY',

  // 服务端口
  API_GATEWAY_PORT: 'API_GATEWAY_PORT',
  AI_CORE_PORT: 'AI_CORE_PORT',

  // 数据库
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
} as const;

/**
 * 错误代码
 */
export const ErrorCodes = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',

  // 内容错误
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  CONTEXT_LENGTH_EXCEEDED: 'CONTEXT_LENGTH_EXCEEDED',

  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;
