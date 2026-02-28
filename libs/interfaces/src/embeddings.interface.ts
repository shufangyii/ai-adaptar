/**
 * 嵌入向量请求
 */
export interface EmbeddingRequest {
  input: string | string[];
  model: string;
  provider?: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

/**
 * 单个嵌入向量
 */
export interface Embedding {
  index: number;
  object: 'embedding';
  embedding: number[] | string;
}

/**
 * 嵌入向量响应
 */
export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  provider: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// TODO: 添加批量嵌入优化接口
// TODO: 添加嵌入向量缓存接口
