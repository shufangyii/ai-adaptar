import { Injectable, Logger } from '@nestjs/common';

/**
 * 数据丢失防护服务 (DlpService)
 *
 * 功能：
 * 1. 扫描文本中的敏感信息（PII：电子邮件、电话、身份证号）
 * 2. 检测 Prompt Injection 攻击（提示词注入）
 * 3. 递归扫描 JSON 对象（支持聊天消息数组等结构化数据）
 *
 * 安全策略：
 * - Fail Open：扫描出错时返回 true（允许请求），避免误杀
 * - 使用正则表达式进行快速检测，不依赖外部服务
 */
@Injectable()
export class DlpService {
  private readonly logger = new Logger(DlpService.name);

  // 1. PII 检测的正则表达式
  private readonly piiPatterns = [
    // 邮箱地址
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    // 中国大陆手机号（11 位，1 开头）
    /1[3-9]\d{9}/,
    // 中国大陆身份证号（15 位或 18 位）
    /\b\d{15}(\d{2}[0-9xX])?\b/,
  ];

  // 2. Prompt Injection 攻击特征检测
  private readonly injectionPatterns = [
    /ignore (all )?previous instructions/i, // 忽略之前的指令
    /system prompt/i, // 系统提示词注入
    /you are a developer/i, // 让模型扮演开发者
    /bypass( restrictions)?/i, // 绕过限制
    /jailbreak/i, // 越狱攻击
    /do anything now/i, // 执行任何操作
    /DAN/i, // "Do Anything Now" 越狱
  ];

  /**
   * 扫描文本中的敏感信息或攻击特征
   * 如果发生错误，采用 Fail Open 策略（返回 true）
   *
   * @param text 待扫描的文本
   * @returns true - 安全，false - 发现违规内容
   */
  scanText(text: string): boolean {
    // 空字符串视为安全
    if (!text) {
      return true;
    }

    try {
      // 1. 检查 PII
      for (const pattern of this.piiPatterns) {
        if (pattern.test(text)) {
          this.logger.warn('DLP Alert: PII detected in text');
          return false; // 发现敏感信息，拒绝请求
        }
      }

      // 2. 检测 Prompt Injection
      for (const pattern of this.injectionPatterns) {
        if (pattern.test(text)) {
          this.logger.warn('DLP Alert: Possible prompt injection detected');
          return false; // 发现攻击特征，拒绝请求
        }
      }

      return true; // 通过检查
    } catch (err: unknown) {
      this.logger.error('DLP Engine encountered an error during scan', err);
      // Fail Open：不阻止流量
      return true;
    }
  }

  /**
   * 递归扫描 JSON 载荷
   * 支持嵌套对象和数组（如 chat messages 数组）
   *
   * @param payload 待扫描的任意 JSON 结构
   * @returns true - 安全，false - 发现违规内容
   */
  scanPayload(payload: unknown): boolean {
    // 字符串：直接扫描
    if (typeof payload === 'string') {
      return this.scanText(payload);
    }

    // 数组：递归扫描每个元素
    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (!this.scanPayload(item)) {
          return false;
        }
      }
      return true;
    }

    // 对象：递归扫描每个值（跳过 key）
    if (payload && typeof payload === 'object') {
      for (const key of Object.keys(payload)) {
        const val = (payload as Record<string, unknown>)[key];
        if (!this.scanPayload(val)) {
          return false;
        }
      }
      return true;
    }

    // 数字、布尔值、null 等视为安全
    return true;
  }
}
