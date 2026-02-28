/**
 * 使用记录
 */
export interface UsageRecord {
  timestamp: number;
  model: string;
  provider: string;
  operation: 'chat' | 'embedding' | 'image' | 'audio';
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

/**
 * 使用统计
 */
export interface UsageStatistics {
  period_start: number;
  period_end: number;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  breakdown: {
    by_model: Record<string, { requests: number; tokens: number; cost: number }>;
    by_provider: Record<string, { requests: number; tokens: number; cost: number }>;
    by_operation: Record<string, { requests: number; tokens: number; cost: number }>;
  };
}

/**
 * 配额信息
 */
export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  reset_at: number;
}

/**
 * 配额检查响应
 */
export interface QuotaCheckResponse {
  allowed: boolean;
  quota: QuotaInfo;
  estimated_cost?: number;
}

// TODO: 添加费用预估响应
// TODO: 添加计费明细查询响应
