import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleDestroy, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import { HttpAgent, HttpsAgent } from 'agentkeepalive';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import CircuitBreaker from 'opossum';
import { RateLimitService } from '../modules/rate-limit/rate-limit.service';

/**
 * 代理服务 (ProxyService)
 *
 * 功能：
 * 1. 将客户端请求转发到 LiteLLM 后端（Chat Completions 和 Models API）
 * 2. 管理连接池（避免 TCP 端口耗尽）
 * 3. 实现熔断器模式（防止雪崩效应）
 * 4. 流式响应处理（SSE）
 * 5. 客户端断开自动取消上游请求（节省 token）
 *
 * 核心优化：
 * - 使用 Node.js 原生 Stream Pipe 直接转发（避免内存占用和延迟）
 * - 连接池复用（HttpAgent/HttpsAgent）
 * - 客户端断开检测（AbortController）
 */
@Injectable()
export class ProxyService implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyService.name);
  private readonly litellmBaseUrl: string; // LiteLLM 代理的后端地址
  private readonly litellmMasterKey: string; // 鉴权用的 Master Key
  private readonly httpAgent: http.Agent; // HTTP 连接池
  private readonly httpsAgent: https.Agent; // HTTPS 连接池
  private readonly breaker: CircuitBreaker<[AxiosRequestConfig], AxiosResponse>; // 熔断器实例

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly rateLimitService: RateLimitService,
  ) {
    this.litellmBaseUrl = this.configService.get<string>('LITELLM_API_BASE')!;
    this.litellmMasterKey =
      this.configService.get<string>('LITELLM_MASTER_KEY')!;

    // 初始化连接池属性，避免高并发下端口耗尽 (TCP Port Exhaustion)
    this.httpAgent = new HttpAgent({
      maxSockets: 1000,
      maxFreeSockets: 100,
      timeout: 60000,
      freeSocketTimeout: 30000,
    });

    this.httpsAgent = new HttpsAgent({
      maxSockets: 1000,
      maxFreeSockets: 100,
      timeout: 60000,
      freeSocketTimeout: 30000,
    });

    // 初始化熔断器 Circuit Breaker
    // 使用 opossum 封装底层的 axios 请求
    const requestAction = async (config: AxiosRequestConfig) => {
      return await this.httpService.axiosRef.request(config);
    };

    const breakerOptions = {
      timeout: 60000, // 熔断器内请求最大超时时间 (与代理超时时间对齐)
      errorThresholdPercentage: 50, // 如果 50% 的请求失败，则触发熔断
      resetTimeout: 10000, // 熔断 10 秒后尝试进入 HALF_OPEN 状态
      capacity: 1000, // 单个节点最大并发数，超出也会导致请求被拒绝（防 Node.js 事件循环阻塞）
      volumeThreshold: 10, // 至少有 10 个请求才开始计算错误率
    };

    this.breaker = new CircuitBreaker(requestAction, breakerOptions);

    // 绑定熔断器状态流转事件日志
    this.breaker.on('open', () =>
      this.logger.error('Circuit Breaker OPEN: Upstream is failing.'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.warn('Circuit Breaker HALF_OPEN: Testing upstream.'),
    );
    this.breaker.on('close', () =>
      this.logger.log('Circuit Breaker CLOSED: Upstream recovered.'),
    );
    this.breaker.on('reject', () =>
      this.logger.error(
        'Circuit Breaker REJECTED: Max capacity reached or circuit open.',
      ),
    );
  }

  onModuleDestroy() {
    this.logger.log('Cleaning up ProxyService resources...');
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    // Circuit breaker cleanup - remove all listeners and disable
    this.breaker.removeAllListeners();
    this.breaker.disable();
  }

  /**
   * 核心方法: 代理转发客户端发来的 Chat Completion 请求到后端的主路由
   */
  async forwardChatCompletions(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const requestId = crypto.randomUUID();

    // Attempt to get trace ID from OpenTelemetry active span
    const activeSpan = trace.getActiveSpan();
    const otelTraceId = activeSpan?.spanContext()?.traceId;

    // Fallback: OpenTelemetry > Client provided > Generate new
    const traceId =
      otelTraceId || (req.headers['trace-id'] as string) || requestId;

    // --- CTO REVIEW POINT: Concurrent Connections Release ---
    // Make sure we always release the concurrency lock exactly once per request.
    let connectionReleased = false;
    const releaseConnectionLimit = () => {
      const keyHash = req.user?.keyHash;
      if (!connectionReleased && keyHash) {
        connectionReleased = true;
        // Run asynchronously without waiting
        void this.rateLimitService
          .releaseConnection(keyHash)
          .catch((err: unknown) => {
            this.logger.error(
              `[${traceId}] Failed to release connection limit`,
              err,
            );
          });
      }
    };

    res.on('close', releaseConnectionLimit);
    res.on('finish', releaseConnectionLimit);
    res.on('error', releaseConnectionLimit);

    // --- CTO REVIEW POINT: Abort Signal Implementation ---
    // If the client (browser, caller app) disconnects early (e.g., closing the tab),
    // we MUST immediately abort the upstream request to LiteLLM to prevent wasted token generation.
    const abortController = new AbortController();
    req.on('close', () => {
      // If the response is not yet fully written to the client, it means it's an unexpected early disconnect.
      if (!res.writableEnded) {
        this.logger.warn(
          `[${traceId}] Client unexpectedly disconnected. Aborting upstream request.`,
        );
        abortController.abort();
      }
    });

    // Only proxy specific safe headers instead of blindly forwarding everything.
    const allowedHeaders = [
      'content-type',
      'accept',
      'x-request-id',
      'trace-id',
      'authorization',
    ];
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (allowedHeaders.includes(k.toLowerCase())) {
        if (v !== undefined && typeof v === 'string') {
          headers[k] = v;
        } else if (Array.isArray(v)) {
          headers[k] = v.join(',');
        }
      }
    }
    headers['x-request-id'] = requestId;
    headers['trace-id'] = traceId; // For our internal tracking down to LiteLLM if needed
    if (otelTraceId) {
      // W3C Trace Context standard format
      // Note: @opentelemetry/instrumentation-http usually injects traceparent automatically,
      // but explicitly setting it here ensures LiteLLM receives our specific span context.
      headers['traceparent'] =
        `00-${otelTraceId}-${activeSpan?.spanContext().spanId || '0000000000000000'}-01`;
    }

    // Set Trace-Id in the response headers so the client can also track it
    res.setHeader('trace-id', traceId);

    // For MVP Phase 1, we replace the tenant's API key with our LiteLLM Master Key.
    headers['authorization'] = `Bearer ${this.litellmMasterKey}`;

    const url = `${this.litellmBaseUrl}/v1/chat/completions`;

    // Get upstream timeout from config
    const upstreamTimeoutStr =
      this.configService.get<string>('UPSTREAM_TIMEOUT');
    const upstreamTimeout = upstreamTimeoutStr
      ? parseInt(upstreamTimeoutStr, 10)
      : 30000;

    // --- CTO REVIEW POINT: Connection Pooling (连接池处理) ---
    // 显式地传入 httpAgent/httpsAgent 利用 keepalive。
    // 在几千并发代理的极限情况下，可以避免直接击穿系统的可用 TCP 端口。
    const axiosConfig: AxiosRequestConfig = {
      method: 'POST',
      url,
      headers,
      data: req.body as unknown,
      responseType: 'stream', // 核心: SSE (Server-Sent Events) 需要直接处理流结构
      timeout: upstreamTimeout, // 上游接口的最长硬性响应超时限制
      signal: abortController.signal,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
    };

    try {
      // Execute the request via Circuit Breaker instead of axios directly
      const response = await this.breaker.fire(axiosConfig);

      // 从上游响应中读取 status 状态码及返回的 headers，并原样拷贝给客户端
      res.status(response.status);
      for (const [key, value] of Object.entries(
        response.headers as Record<string, unknown>,
      )) {
        res.setHeader(key, value as string | string[]);
      }

      // --- CTO REVIEW POINT: Native Node.js Stream Piping (原生流媒体管道化) ---
      // 我们在此绝对不走 NestJS 默认的 Interceptor 对 Response 的序列化特性。
      // 它会将内容完全拉取到内存缓存完毕再处理，导致 OOM 和极长的首字点亮延迟 (TTFT)。
      // 通过 node 原生 pipe 直接转发比特流：
      const stream = response.data as NodeJS.ReadableStream;

      stream.pipe(res);

      stream.on('error', (err: Error) => {
        this.logger.error(`[${traceId}] Stream error from upstream:`, err);
        // 若流中断时，HTTP响应头尚未来得及发出，则直接返回 500 API 错误
        if (!res.headersSent) {
          res.status(500).json({ error: 'Upstream stream error' });
        } else {
          // 由于请求头已发送，不能再改 Status 码，
          // 用符合 SSE 标准的一个 JSON 对象当作错误的数据块 push 进流的末尾，增强客户端前端报错的鲁棒性。
          res.write(`data: {"error": "Upstream connection broken"}\n\n`);
          res.end();
        }
      });
    } catch (error: unknown) {
      // If the error is thrown by the Circuit Breaker because it's open
      const err = error as Error & { code?: string };
      if (err?.code === 'EOPENBREAKER') {
        this.logger.warn(
          `[${traceId}] Request rejected: Circuit Breaker is OPEN`,
        );
        if (!res.headersSent) {
          res
            .status(503)
            .json({ error: 'Service Unavailable - Upstream circuit open' });
        }
        return;
      }

      // If the error was thrown because WE aborted it (due to client disconnect),
      // just log and exit cleanly.
      if (axios.isCancel(error)) {
        this.logger.warn(
          `[${traceId}] Upstream request canceled due to client disconnect.`,
        );
        return;
      }

      let status = 504;
      let data: unknown = { error: 'Gateway timeout or upstream error' };
      let message = 'Unknown error';

      if (axios.isAxiosError(error)) {
        status = error.response?.status ? Number(error.response.status) : 504;
        data = error.response?.data || data;
        message = error.message || message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      this.logger.error(`[${traceId}] Forwarding error: ${message}`);

      // 没有发出响应时，根据返回的 Body 拦截报错抛给调用方
      if (!res.headersSent) {
        if (
          data &&
          typeof data === 'object' &&
          'pipe' in data &&
          typeof (data as NodeJS.ReadableStream).pipe === 'function'
        ) {
          res.status(status);
          (data as NodeJS.ReadableStream).pipe(res);
        } else {
          res.status(status).json(data);
        }
      }
    }
  }

  /**
   * 代理转发查询受支持模型列表的请求
   */
  async forwardModels(
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.litellmBaseUrl}/v1/models`;
    try {
      // Execute the request via Circuit Breaker instead of axios directly
      const response = await this.breaker.fire({
        method: 'GET',
        url,
        headers: { Authorization: `Bearer ${this.litellmMasterKey}` },
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        timeout: 10000,
      });

      res.status(response.status).json(response.data);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err?.code === 'EOPENBREAKER') {
        res
          .status(503)
          .json({ error: 'Service Unavailable - Upstream circuit open' });
        return;
      }
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status
          ? Number(error.response.status)
          : 500;
        const data = (error.response.data as unknown) || {
          error: 'Internal Server Error',
        };
        res.status(status).json(data);
      } else {
        const status = 500;
        const data = { error: 'Internal Server Error' };
        res.status(status).json(data);
      }
    }
  }
}
