/**
 * 事件类型
 */
export enum EventType {
  // 请求事件
  REQUEST_START = 'request.start',
  REQUEST_END = 'request.end',
  REQUEST_ERROR = 'request.error',

  // 计费事件
  USAGE_RECORDED = 'usage.recorded',
  QUOTA_EXCEEDED = 'quota.exceeded',

  // 提供商事件
  PROVIDER_CONNECTED = 'provider.connected',
  PROVIDER_DISCONNECTED = 'provider.disconnected',
  PROVIDER_ERROR = 'provider.error',

  // 模型事件
  MODEL_LOADED = 'model.loaded',
  MODEL_UNLOADED = 'model.unloaded',

  // 系统事件
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
}

/**
 * 基础事件
 */
export interface BaseEvent {
  type: EventType;
  timestamp: number;
  correlationId: string;
}

/**
 * 请求开始事件
 */
export interface RequestStartEvent extends BaseEvent {
  type: EventType.REQUEST_START;
  data: {
    userId?: string;
    provider: string;
    model: string;
    operation: string;
  };
}

/**
 * 请求结束事件
 */
export interface RequestEndEvent extends BaseEvent {
  type: EventType.REQUEST_END;
  data: {
    userId?: string;
    provider: string;
    model: string;
    operation: string;
    duration: number;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    cost: number;
  };
}

/**
 * 请求错误事件
 */
export interface RequestErrorEvent extends BaseEvent {
  type: EventType.REQUEST_ERROR;
  data: {
    userId?: string;
    provider: string;
    model: string;
    operation: string;
    error: string;
    code: string;
  };
}

/**
 * 使用记录事件
 */
export interface UsageRecordedEvent extends BaseEvent {
  type: EventType.USAGE_RECORDED;
  data: {
    userId: string;
    provider: string;
    model: string;
    tokens: number;
    cost: number;
  };
}

/**
 * 配额超限事件
 */
export interface QuotaExceededEvent extends BaseEvent {
  type: EventType.QUOTA_EXCEEDED;
  data: {
    userId: string;
    quota: number;
    used: number;
    requested: number;
  };
}

/**
 * 提供商连接事件
 */
export interface ProviderConnectedEvent extends BaseEvent {
  type: EventType.PROVIDER_CONNECTED;
  data: {
    provider: string;
    models: string[];
  };
}

/**
 * 提供商断开事件
 */
export interface ProviderDisconnectedEvent extends BaseEvent {
  type: EventType.PROVIDER_DISCONNECTED;
  data: {
    provider: string;
    reason: string;
  };
}

/**
 * 提供商错误事件
 */
export interface ProviderErrorEvent extends BaseEvent {
  type: EventType.PROVIDER_ERROR;
  data: {
    provider: string;
    error: string;
    code: string;
  };
}

/**
 * 事件监听器
 */
export type EventListener = (event: BaseEvent) => void | Promise<void>;

// TODO: 添加更多事件类型
// TODO: 添加事件过滤和路由配置
