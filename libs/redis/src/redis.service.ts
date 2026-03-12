import { Injectable, OnModuleDestroy, Logger, OnModuleInit } from '@nestjs/common';
import { Redis, Cluster } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | Cluster;

  constructor() {
    const isCluster = process.env.REDIS_CLUSTER_MODE === 'true';
    const redisUrl = process.env.REDIS_URL!;

    if (isCluster) {
      // For cluster mode, we expect REDIS_URL to contain comma-separated node addresses,
      // or we just parse the single URL as a seed node.
      const nodes = redisUrl.split(',').map((url) => url.trim());
      this.client = new Cluster(nodes, {
        redisOptions: {
          connectTimeout: 5000,
          maxRetriesPerRequest: 3,
        },
        clusterRetryStrategy: (times) => Math.min(times * 100, 3000),
      });
      this.logger.log('Redis initialized in CLUSTER mode');
    } else {
      this.client = new Redis(redisUrl, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
      this.logger.log('Redis initialized in STANDALONE mode');
    }

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis successfully');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  async onModuleInit() {
    // Health check on startup
    try {
      await this.client.ping();
      this.logger.log('Redis health check passed');
    } catch (err) {
      this.logger.error('Redis health check failed', err);
    }
  }

  onModuleDestroy() {
    this.logger.log('Disconnecting from Redis...');
    this.client.quit();
  }

  // Expose the underlying client directly for advanced use cases
  getClient(): Redis | Cluster {
    return this.client;
  }

  // Common Redis operations wrappers
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }
}
