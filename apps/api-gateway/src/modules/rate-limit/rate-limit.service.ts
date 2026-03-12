import {
  Injectable,
  OnModuleInit,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '@llm-gateway/redis';
import { Redis, Cluster } from 'ioredis';

/**
 * 限流服务接口定义
 * 描述限流检查的参数和 Lua 脚本返回结果
 */
export interface RateLimitCheckParams {
  ip: string; // 客户端 IP 地址
  apiKeyHash: string; // API Key 的哈希值（用于限流）
  tenantId: string; // 租户 ID
  model: string; // 使用的模型名称
  qpsLimit: number; // 每秒请求数限制
  tpmLimit: number; // 每分钟请求数限制
  concurrentLimit: number; // 最大并发连接数
}

/**
 * Lua 脚本返回结果类型
 * [1, "OK"] - 成功
 * [0, "REASON"] - 失败
 */
type RateLimitScriptResult = [number, string];

/**
 * Redis 客户端扩展类型
 * 添加自定义的 checkRateLimits 方法
 */
interface RateLimitRedis extends Redis {
  checkRateLimits(...args: (string | number)[]): Promise<RateLimitScriptResult>;
  defineCommand(
    name: string,
    options: { numberOfKeys: number; lua: string },
  ): void;
}

interface RateLimitCluster extends Cluster {
  checkRateLimits(...args: (string | number)[]): Promise<RateLimitScriptResult>;
  defineCommand(
    name: string,
    options: { numberOfKeys: number; lua: string },
  ): void;
}

type ExtendedRedisClient = RateLimitRedis | RateLimitCluster;

/**
 * 限流服务 (RateLimitService)
 *
 * 功能：
 * 1. 5 维度限流检查（IP 黑名单、QPS、TPM、模型 QPS、并发连接数）
 * 2. 使用 Redis Lua 脚本保证原子性操作
 * 3. Token Bucket 算法实现限流
 *
 * 限流维度：
 * - IP 黑名单：直接拒绝
 * - QPS：每秒请求数（针对整个 API Key）
 * - TPM：每分钟请求数（针对整个 API Key）
 * - MQPS：模型级别 QPS（针对特定模型）
 * - 并发：最大并发连接数（防止资源耗尽）
 */
@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * 模块初始化时注册 Lua 脚本
   * 使用 Redis 自定义命令封装限流逻辑，保证原子性
   */
  onModuleInit() {
    const client = this.redis.getClient() as unknown as ExtendedRedisClient;

    // 定义 5 维度限流 Lua 脚本
    // KEYS[1]: IP 黑名单
    // KEYS[2]: QPS 限流
    // KEYS[3]: TPM 限流
    // KEYS[4]: 模型 QPS 限流
    // KEYS[5]: 并发连接数
    const script = `
local ip_key = KEYS[1]
local qps_key = KEYS[2]
local tpm_key = KEYS[3]
local mqps_key = KEYS[4]
local conn_key = KEYS[5]

local now = tonumber(ARGV[1])
local qps_cap = tonumber(ARGV[2])
local qps_rate = tonumber(ARGV[3])
local tpm_cap = tonumber(ARGV[4])
local tpm_rate = tonumber(ARGV[5])
local mqps_cap = tonumber(ARGV[6])
local mqps_rate = tonumber(ARGV[7])
local conn_limit = tonumber(ARGV[8])
local ttl = tonumber(ARGV[9])

-- 1. IP 黑名单检查
if ip_key ~= "" then
    if redis.call('EXISTS', ip_key) == 1 then
        return {0, "IP_BLACKLISTED"}
    end
end

-- 2. 并发连接数检查
if conn_key ~= "" and conn_limit > 0 then
    local current_conn = tonumber(redis.call('GET', conn_key) or '0')
    if current_conn >= conn_limit then
        return {0, "CONCURRENT_LIMIT_EXCEEDED"}
    end
end

-- Token Bucket 限流算法（可复用）
local function check_bucket(key, capacity, rate)
    if key == "" or capacity <= 0 then return true, 0, now end
    local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
    local tokens = tonumber(bucket[1])
    local last_update = tonumber(bucket[2])

    if tokens == nil then
        tokens = capacity
        last_update = now
    else
        local delta = math.max(0, now - last_update)
        tokens = math.min(capacity, tokens + delta * rate)
    end

    if tokens >= 1 then
        return true, tokens - 1, now
    else
        return false, tokens, last_update
    end
end

-- 3. QPS 检查
local q_ok, q_tok, q_time = check_bucket(qps_key, qps_cap, qps_rate)
if not q_ok then return {0, "QPS_LIMIT_EXCEEDED"} end

-- 4. TPM 检查
local t_ok, t_tok, t_time = check_bucket(tpm_key, tpm_cap, tpm_rate)
if not t_ok then return {0, "TPM_LIMIT_EXCEEDED"} end

-- 5. 模型 QPS 检查
local m_ok, m_tok, m_time = check_bucket(mqps_key, mqps_cap, mqps_rate)
if not m_ok then return {0, "MODEL_QPS_LIMIT_EXCEEDED"} end

-- 所有检查通过！应用 Token 扣减并增加连接计数器

if conn_key ~= "" and conn_limit > 0 then
    redis.call('INCR', conn_key)
    -- 延长连接 TTL，防止进程崩溃后连接泄漏
    redis.call('EXPIRE', conn_key, 65)
end

if qps_key ~= "" and qps_cap > 0 then
    redis.call('HMSET', qps_key, 'tokens', q_tok, 'last_update', q_time)
    redis.call('EXPIRE', qps_key, ttl)
end

if tpm_key ~= "" and tpm_cap > 0 then
    redis.call('HMSET', tpm_key, 'tokens', t_tok, 'last_update', t_time)
    redis.call('EXPIRE', tpm_key, 120)
end

if mqps_key ~= "" and mqps_cap > 0 then
    redis.call('HMSET', mqps_key, 'tokens', m_tok, 'last_update', m_time)
    redis.call('EXPIRE', mqps_key, ttl)
end

return {1, "OK"}
    `;

    // 在 Redis 客户端上注册自定义命令
    client.defineCommand('checkRateLimits', {
      numberOfKeys: 5,
      lua: script,
    });
    this.logger.log('Rate limiting Lua script loaded');
  }

  /**
   * 执行限流检查（调用 Lua 脚本）
   *
   * @param params 限流检查参数
   * @returns boolean - 如果通过限流检查返回 true
   */
  async checkLimits(params: RateLimitCheckParams): Promise<boolean> {
    const {
      ip,
      apiKeyHash,
      tenantId,
      model,
      qpsLimit,
      tpmLimit,
      concurrentLimit,
    } = params;

    // 构造 Redis Key
    const keys = [
      `rl:ip_black:${ip}`, // IP 黑名单
      `rl:qps:${apiKeyHash}`, // API Key QPS
      `rl:tpm:${tenantId}`, // 租户 TPM
      `rl:mqps:${apiKeyHash}:${model}`, // 模型 QPS
      `rl:conn:${apiKeyHash}`, // 并发连接数
    ];

    const now = Math.floor(Date.now() / 1000); // 当前时间戳（秒）

    // QPS：每秒容量 = limit，速率 = limit
    const qpsRate = qpsLimit;
    // TPM：每分钟容量 = limit，速率 = limit / 60
    const tpmRate = tpmLimit / 60;

    // 模型 QPS：使用相同的 QPS 限制（可配置）
    const mqpsLimit = qpsLimit;
    const mqpsRate = qpsLimit;

    const ttl = 60; // QPS 和 MQPS 的 TTL

    const args = [
      now,
      qpsLimit,
      qpsRate,
      tpmLimit,
      tpmRate,
      mqpsLimit,
      mqpsRate,
      concurrentLimit,
      ttl,
    ];

    const client = this.redis.getClient() as unknown as ExtendedRedisClient;

    try {
      // 执行 Lua 脚本（原子性操作）
      const [result, reason] = await client.checkRateLimits(...keys, ...args);
      const isAllowed = result === 1;

      if (!isAllowed) {
        this.logger.warn(
          `Rate limit exceeded for key ${apiKeyHash}. Reason: ${reason}`,
        );
        throw new HttpException(
          `Rate limit exceeded: ${reason}`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error('Failed to execute rate limit script', err);
      // Fail Open：Redis 不可用时允许请求（避免阻塞业务）
      return true;
    }
  }

  /**
   * 释放并发连接数
   * 在请求流结束时调用，防止连接泄漏
   *
   * @param apiKeyHash API Key 哈希值
   */
  async releaseConnection(apiKeyHash: string): Promise<void> {
    if (!apiKeyHash) return;
    const connKey = `rl:conn:${apiKeyHash}`;
    const client = this.redis.getClient();

    try {
      // 减少并发连接计数
      const current = await client.decr(connKey);
      if (current < 0) {
        // 防止负值（防止多次调用）
        await client.set(connKey, 0);
      }
    } catch (err: unknown) {
      this.logger.error('Failed to release connection limit', err);
    }
  }
}
