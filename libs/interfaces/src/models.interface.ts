/**
 * 模型能力
 */
export interface ModelCapability {
  chat: boolean;
  streaming: boolean;
  function_calling: boolean;
  vision: boolean;
  embeddings: boolean;
  images: boolean;
  audio_input?: boolean;
  audio_output?: boolean;
  json_mode: boolean;
  max_tokens: number;
  context_window: number;
}

/**
 * 模型定价
 */
export interface ModelPricing {
  input: number; // per 1M tokens
  output: number; // per 1M tokens
  currency?: string;
}

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'completion' | 'embedding' | 'image' | 'audio';
  capability: ModelCapability;
  pricing?: ModelPricing;
  status: 'available' | 'deprecated' | 'beta';
}

/**
 * 模型列表响应
 */
export interface ModelListResponse {
  object: 'list';
  data: ModelInfo[];
}

/**
 * 模型详情响应
 */
export interface ModelResponse {
  object: 'model';
  id: string;
  info: ModelInfo;
}

// TODO: 添加模型对比接口
// TODO: 添加模型推荐接口
