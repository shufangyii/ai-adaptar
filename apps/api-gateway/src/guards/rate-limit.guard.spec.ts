import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from '../modules/rate-limit/rate-limit.service';
import { RedisService } from '@llm-gateway/redis';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitGuard (Integration)', () => {
  let guard: RateLimitGuard;
  let rateLimitService: RateLimitService;
  let redisService: RedisService;

  // Helper function to create mock ExecutionContext
  const createMockContext = (
    user?: {
      keyHash: string;
      tenantId: string;
      rateLimitConfig?: {
        qpsLimit: number;
        tpmLimit: number;
        concurrent: number;
      };
    },
    body?: Record<string, unknown>,
  ): ExecutionContext => {
    const mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      user,
      body: body || {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    // Create a mock Redis client that will be reused
    const mockRedisClient = {
      defineCommand: jest.fn(),
      checkRateLimits: jest.fn(),
      decr: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        RateLimitService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
    redisService = module.get<RedisService>(RedisService);

    // Initialize the Lua script
    rateLimitService.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // RL-001: QPS 限流
  describe('RL-001: QPS Rate Limiting', () => {
    it('should return 429 when QPS limit is exceeded', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 2,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: First 2 requests succeed, 3rd fails
      client.checkRateLimits
        .mockResolvedValueOnce([1, 'OK'])
        .mockResolvedValueOnce([1, 'OK'])
        .mockResolvedValueOnce([0, 'QPS_LIMIT_EXCEEDED']);

      // First 2 requests should pass
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // 3rd request should be rejected
      try {
        await guard.canActivate(context);
        fail('Should have thrown HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        expect((err as HttpException).message).toContain('QPS_LIMIT_EXCEEDED');
      }
    });

    it('should allow requests when QPS limit is not exceeded', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 100,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };
      client.checkRateLimits.mockResolvedValue([1, 'OK']);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // RL-002: 并发限流
  describe('RL-002: Concurrent Connection Limiting', () => {
    it('should return 429 when concurrent limit is exceeded', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 100,
          tpmLimit: 10000,
          concurrent: 2,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: First 2 concurrent requests succeed, 3rd fails
      client.checkRateLimits
        .mockResolvedValueOnce([1, 'OK'])
        .mockResolvedValueOnce([1, 'OK'])
        .mockResolvedValueOnce([0, 'CONCURRENT_LIMIT_EXCEEDED']);

      // First 2 concurrent requests should pass
      await expect(guard.canActivate(context)).resolves.toBe(true);
      await expect(guard.canActivate(context)).resolves.toBe(true);

      // 3rd concurrent request should be rejected
      try {
        await guard.canActivate(context);
        fail('Should have thrown HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        expect((err as HttpException).message).toContain(
          'CONCURRENT_LIMIT_EXCEEDED',
        );
      }
    });

    it('should allow requests when concurrent limit is not exceeded', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 100,
          tpmLimit: 10000,
          concurrent: 10,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };
      client.checkRateLimits.mockResolvedValue([1, 'OK']);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // RL-003: 并发释放
  describe('RL-003: Concurrent Connection Release', () => {
    it('should release concurrent connection after stream ends', async () => {
      const keyHash = 'test-key-hash';
      const client = redisService.getClient() as {
        decr: jest.Mock;
        set: jest.Mock;
      };

      // Mock: decr returns 1 (still has 1 connection)
      client.decr.mockResolvedValue(1);

      await rateLimitService.releaseConnection(keyHash);

      // Verify that decr was called with correct key
      expect(client.decr).toHaveBeenCalledWith(`rl:conn:${keyHash}`);
      expect(client.set).not.toHaveBeenCalled();
    });

    it('should prevent negative connection count', async () => {
      const keyHash = 'test-key-hash';
      const client = redisService.getClient() as {
        decr: jest.Mock;
        set: jest.Mock;
      };

      // Mock: decr returns -1 (negative value)
      client.decr.mockResolvedValue(-1);

      await rateLimitService.releaseConnection(keyHash);

      // Verify that negative value is corrected to 0
      expect(client.decr).toHaveBeenCalledWith(`rl:conn:${keyHash}`);
      expect(client.set).toHaveBeenCalledWith(`rl:conn:${keyHash}`, 0);
    });

    it('should handle multiple releaseConnection calls idempotently', async () => {
      const keyHash = 'test-key-hash';
      const client = redisService.getClient() as {
        decr: jest.Mock;
        set: jest.Mock;
      };

      // Mock: First call returns 0, subsequent calls return negative values
      client.decr
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(-1)
        .mockResolvedValueOnce(-2);

      // Call releaseConnection 3 times
      await rateLimitService.releaseConnection(keyHash);
      await rateLimitService.releaseConnection(keyHash);
      await rateLimitService.releaseConnection(keyHash);

      // Verify that negative values are corrected
      expect(client.set).toHaveBeenCalledTimes(2);
      expect(client.set).toHaveBeenCalledWith(`rl:conn:${keyHash}`, 0);
    });

    it('should handle empty keyHash gracefully', async () => {
      const client = redisService.getClient() as {
        decr: jest.Mock;
      };

      await rateLimitService.releaseConnection('');

      // Should not call Redis when keyHash is empty
      expect(client.decr).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const keyHash = 'test-key-hash';
      const client = redisService.getClient() as {
        decr: jest.Mock;
      };

      // Mock Redis error
      client.decr.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error
      await expect(
        rateLimitService.releaseConnection(keyHash),
      ).resolves.toBeUndefined();
    });
  });

  // RL-004: TPM 限流
  describe('RL-004: TPM Rate Limiting', () => {
    it('should return 429 when TPM limit is exceeded', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 100,
          tpmLimit: 100, // Very low TPM limit
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: TPM limit exceeded
      client.checkRateLimits.mockResolvedValue([0, 'TPM_LIMIT_EXCEEDED']);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Rate limit exceeded: TPM_LIMIT_EXCEEDED',
      );
    });
  });

  // RL-005: 模型 QPS 限流
  describe('RL-005: Model-Specific QPS Limiting', () => {
    it('should return 429 when model-specific QPS is exceeded', async () => {
      const context = createMockContext(
        {
          keyHash: 'test-key-hash',
          tenantId: 'test-tenant',
          rateLimitConfig: {
            qpsLimit: 10,
            tpmLimit: 10000,
            concurrent: 5,
          },
        },
        { model: 'gpt-4' },
      );

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: Model QPS limit exceeded
      client.checkRateLimits.mockResolvedValue([0, 'MODEL_QPS_LIMIT_EXCEEDED']);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Rate limit exceeded: MODEL_QPS_LIMIT_EXCEEDED',
      );
    });

    it('should track different models separately', async () => {
      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: All requests succeed
      client.checkRateLimits.mockResolvedValue([1, 'OK']);

      // Request with gpt-4
      const context1 = createMockContext(
        {
          keyHash: 'test-key-hash',
          tenantId: 'test-tenant',
          rateLimitConfig: {
            qpsLimit: 10,
            tpmLimit: 10000,
            concurrent: 5,
          },
        },
        { model: 'gpt-4' },
      );

      await expect(guard.canActivate(context1)).resolves.toBe(true);

      // Request with gpt-3.5-turbo
      const context2 = createMockContext(
        {
          keyHash: 'test-key-hash',
          tenantId: 'test-tenant',
          rateLimitConfig: {
            qpsLimit: 10,
            tpmLimit: 10000,
            concurrent: 5,
          },
        },
        { model: 'gpt-3.5-turbo' },
      );

      await expect(guard.canActivate(context2)).resolves.toBe(true);

      // Verify that different model keys were used
      expect(client.checkRateLimits).toHaveBeenCalledTimes(2);
    });
  });

  // Edge Cases
  describe('Edge Cases', () => {
    it('should skip rate limiting when user is not authenticated', async () => {
      const context = createMockContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should skip rate limiting when rateLimitConfig is missing', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should use default model when body.model is not provided', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 10,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };
      client.checkRateLimits.mockResolvedValue([1, 'OK']);

      await guard.canActivate(context);

      // Verify that 'default' model was used in the key
      const callArgs = client.checkRateLimits.mock.calls[0];
      expect(callArgs[3]).toContain(':default'); // mqps key should contain :default
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      const mockRequest = {
        headers: { 'x-forwarded-for': '203.0.113.1' },
        ip: '127.0.0.1',
        user: {
          keyHash: 'test-key-hash',
          tenantId: 'test-tenant',
          rateLimitConfig: {
            qpsLimit: 10,
            tpmLimit: 10000,
            concurrent: 5,
          },
        },
        body: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };
      client.checkRateLimits.mockResolvedValue([1, 'OK']);

      await guard.canActivate(context);

      // Verify that X-Forwarded-For IP was used
      const callArgs = client.checkRateLimits.mock.calls[0];
      expect(callArgs[0]).toContain('203.0.113.1'); // IP blacklist key
    });

    it('should handle Redis failure with Fail Open strategy', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 10,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock Redis connection failure
      client.checkRateLimits.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should allow request (Fail Open)
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  // IP Blacklist
  describe('IP Blacklist', () => {
    it('should return 429 when IP is blacklisted', async () => {
      const context = createMockContext({
        keyHash: 'test-key-hash',
        tenantId: 'test-tenant',
        rateLimitConfig: {
          qpsLimit: 10,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });

      const client = redisService.getClient() as {
        checkRateLimits: jest.Mock;
      };

      // Mock: IP is blacklisted
      client.checkRateLimits.mockResolvedValue([0, 'IP_BLACKLISTED']);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Rate limit exceeded: IP_BLACKLISTED',
      );
    });
  });

  // Test Mode
  describe('Test Mode', () => {
    it('should force 429 when x-test-rate-limit header is true', async () => {
      const mockRequest = {
        headers: { 'x-test-rate-limit': 'true' },
        ip: '127.0.0.1',
        user: {
          keyHash: 'test-key-hash',
          tenantId: 'test-tenant',
          rateLimitConfig: {
            qpsLimit: 100,
            tpmLimit: 10000,
            concurrent: 5,
          },
        },
        body: {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Too Many Requests',
      );
    });
  });
});
