/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAgent, HttpsAgent } from 'agentkeepalive';
import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly litellmBaseUrl: string; // LiteLLM 代理的后端地址
  private readonly litellmMasterKey: string; // 鉴权用的 Master Key
  private readonly httpAgent: http.Agent; // HTTP 连接池
  private readonly httpsAgent: https.Agent; // HTTPS 连接池

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.litellmBaseUrl =
      this.configService.get<string>('LITELLM_API_BASE') ||
      'http://localhost:4000';
    this.litellmMasterKey =
      this.configService.get<string>('LITELLM_MASTER_KEY') || '';

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
  }

  /**
   * 核心方法: 代理转发客户端发来的 Chat Completion 请求到后端的主路由
   */
  async forwardChatCompletions(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    const traceId = (req.headers['trace-id'] as string) || requestId;

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
    headers['trace-id'] = traceId;

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
      data: req.body,
      responseType: 'stream', // 核心: SSE (Server-Sent Events) 需要直接处理流结构
      timeout: upstreamTimeout, // 上游接口的最长硬性响应超时限制
      signal: abortController.signal,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
    };

    try {
      const response = await this.httpService.axiosRef.request(axiosConfig);

      // 从上游响应中读取 status 状态码及返回的 headers，并原样拷贝给客户端
      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value as string | string[]);
      }

      // --- CTO REVIEW POINT: Native Node.js Stream Piping (原生流媒体管道化) ---
      // 我们在此绝对不走 NestJS 默认的 Interceptor 对 Response 的序列化特性。
      // 它会将内容完全拉取到内存缓存完毕再处理，导致 OOM 和极长的首字点亮延迟 (TTFT)。
      // 通过 node 原生 pipe 直接转发比特流：
      const stream = response.data;

      stream.pipe(res);

      stream.on('error', (err: any) => {
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
      // If the error was thrown because WE aborted it (due to client disconnect),
      // just log and exit cleanly.
      if (axios.isCancel(error)) {
        this.logger.warn(
          `[${traceId}] Upstream request canceled due to client disconnect.`,
        );
        return;
      }

      const err = error as any;
      const status = err.response?.status ? Number(err.response.status) : 504;

      const data = err.response?.data || {
        error: 'Gateway timeout or upstream error',
      };
      const message = err.message ? String(err.message) : 'Unknown error';

      this.logger.error(`[${traceId}] Forwarding error: ${message}`);

      // 没有发出响应时，根据返回的 Body 拦截报错抛给调用方
      if (!res.headersSent) {
        if (data && typeof data.pipe === 'function') {
          res.status(status);

          data.pipe(res);
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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = `${this.litellmBaseUrl}/v1/models`;
    try {
      const response = await this.httpService.axiosRef.get(url, {
        headers: { Authorization: `Bearer ${this.litellmMasterKey}` },
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        timeout: 10000,
      });
      res.status(response.status).json(response.data);
    } catch (error: unknown) {
      const err = error as any;
      const status = err.response?.status ? Number(err.response.status) : 500;

      const data = err.response?.data || { error: 'Internal Server Error' };
      res.status(status).json(data);
    }
  }
}
