/**
 * 图像尺寸
 */
export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

/**
 * 图像格式
 */
export type ImageFormat = 'url' | 'b64_json';

/**
 * 图像质量
 */
export type ImageQuality = 'standard' | 'hd';

/**
 * 图像风格
 */
export type ImageStyle = 'vivid' | 'natural';

/**
 * 图像生成请求
 */
export interface ImageGenerationRequest {
  prompt: string;
  model: string;
  provider?: string;
  n?: number;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  response_format?: ImageFormat;
  user?: string;
}

/**
 * 图像数据
 */
export interface ImageData {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/**
 * 图像生成响应
 */
export interface ImageGenerationResponse {
  created: number;
  data: ImageData[];
  provider: string;
  model: string;
}

/**
 * 图像编辑请求
 */
export interface ImageEditRequest {
  image: string; // base64 or URL
  mask?: string; // base64 or URL
  prompt: string;
  model: string;
  provider?: string;
  n?: number;
  size?: ImageSize;
  response_format?: ImageFormat;
}

/**
 * 图像变体请求
 */
export interface ImageVariationRequest {
  image: string;
  model: string;
  provider?: string;
  n?: number;
  size?: ImageSize;
  response_format?: ImageFormat;
}

// TODO: 添加图像理解/Vision 接口
// TODO: 添加图像修复/Inpainting 接口
