import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '@llm-gateway/database';
import { RedisService } from '@llm-gateway/redis';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  // Helper function to create mock ExecutionContext
  const createMockContext = (authHeader?: string): ExecutionContext => {
    const mockRequest = {
      headers: authHeader ? { authorization: authHeader } : {},
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const mockPrismaService = {
      apiKey: {
        findFirst: jest.fn(),
      },
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // AUTH-001: 无 Authorization Header
  describe('AUTH-001: Missing Authorization Header', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing or invalid Authorization header',
      );
    });

    it('should return 401 when Authorization header is empty', async () => {
      const context = createMockContext('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // AUTH-002: 错误的 Bearer 前缀
  describe('AUTH-002: Invalid Authorization Header Format', () => {
    it('should return 401 when Authorization header has wrong prefix (Basic)', async () => {
      const context = createMockContext('Basic sk-test-key');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing or invalid Authorization header',
      );
    });

    it('should return 401 when Authorization header has no prefix', async () => {
      const context = createMockContext('sk-test-key');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 401 when Authorization header has wrong case (bearer)', async () => {
      const context = createMockContext('bearer sk-test-key');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // AUTH-003: 非法 API Key (Hash 不匹配)
  describe('AUTH-003: Invalid API Key', () => {
    it('should return 401 when API key is not found in database', async () => {
      const context = createMockContext('Bearer sk-invalid-key');

      // Mock Redis cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returns null (key not found)
      prismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid API Key',
      );

      // Verify that invalid key is cached
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('apikey:'),
        'INVALID',
        300,
      );
    });

    it('should return 401 when API key is cached as INVALID', async () => {
      const context = createMockContext('Bearer sk-invalid-key');

      // Mock Redis returns INVALID
      redisService.get.mockResolvedValue('INVALID');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid API Key',
      );

      // Database should not be queried
      expect(prismaService.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it('should return 401 when tenant status is not ACTIVE', async () => {
      const context = createMockContext('Bearer sk-test-key');
      const keyHash = createHash('sha256').update('sk-test-key').digest('hex');

      // Mock Redis cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returns key with inactive tenant
      prismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-id',
        tenantId: 'tenant-id',
        keyHash,
        name: 'Test Key',
        versionNumber: 1,
        status: 'ACTIVE',
        createdAt: new Date(),
        expiresAt: null,
        tenant: {
          id: 'tenant-id',
          name: 'Test Tenant',
          description: null,
          status: 'SUSPENDED', // Tenant is suspended
          balance: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        rateLimitConfig: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid API Key',
      );

      // Verify that invalid result is cached
      expect(redisService.set).toHaveBeenCalledWith(
        `apikey:${keyHash}`,
        'INVALID',
        300,
      );
    });
  });

  // AUTH-004: 合法 API Key
  describe('AUTH-004: Valid API Key', () => {
    it('should return true when API key is valid', async () => {
      const context = createMockContext('Bearer sk-valid-key');
      const keyHash = createHash('sha256').update('sk-valid-key').digest('hex');

      // Mock Redis cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returns valid key
      prismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-id',
        tenantId: 'tenant-id',
        keyHash,
        name: 'Test Key',
        versionNumber: 1,
        status: 'ACTIVE',
        createdAt: new Date(),
        expiresAt: null,
        tenant: {
          id: 'tenant-id',
          name: 'Test Tenant',
          description: null,
          status: 'ACTIVE',
          balance: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        rateLimitConfig: {
          id: 'config-id',
          apiKeyId: 'key-id',
          qpsLimit: 60,
          tpmLimit: 10000,
          concurrent: 5,
          models: '*',
        },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      // Verify that valid key is cached
      expect(redisService.set).toHaveBeenCalledWith(
        `apikey:${keyHash}`,
        expect.stringContaining('tenant-id'),
        3600,
      );

      // Verify that request.user is populated
      const request = context.switchToHttp().getRequest();
      expect(request.user).toBeDefined();
      expect(request.user.tenantId).toBe('tenant-id');
      expect(request.user.keyHash).toBe(keyHash);
      expect(request.user.rateLimitConfig).toBeDefined();
    });
  });

  // AUTH-005: API Key 已过期
  describe('AUTH-005: Expired API Key', () => {
    it('should return 401 when API key is expired', async () => {
      const context = createMockContext('Bearer sk-expired-key');
      const keyHash = createHash('sha256')
        .update('sk-expired-key')
        .digest('hex');

      // Mock Redis cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returns expired key
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      prismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-id',
        tenantId: 'tenant-id',
        keyHash,
        name: 'Test Key',
        versionNumber: 1,
        status: 'ACTIVE',
        createdAt: new Date(),
        expiresAt: yesterday, // Expired yesterday
        tenant: {
          id: 'tenant-id',
          name: 'Test Tenant',
          description: null,
          status: 'ACTIVE',
          balance: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        rateLimitConfig: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'API Key has expired',
      );

      // Verify that expired key is cached as INVALID
      expect(redisService.set).toHaveBeenCalledWith(
        `apikey:${keyHash}`,
        'INVALID',
        300,
      );
    });

    it('should allow API key with future expiration date', async () => {
      const context = createMockContext('Bearer sk-future-key');
      const keyHash = createHash('sha256')
        .update('sk-future-key')
        .digest('hex');

      // Mock Redis cache miss
      redisService.get.mockResolvedValue(null);

      // Mock database query returns key with future expiration
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      prismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-id',
        tenantId: 'tenant-id',
        keyHash,
        name: 'Test Key',
        versionNumber: 1,
        status: 'ACTIVE',
        createdAt: new Date(),
        expiresAt: tomorrow, // Expires tomorrow
        tenant: {
          id: 'tenant-id',
          name: 'Test Tenant',
          description: null,
          status: 'ACTIVE',
          balance: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        rateLimitConfig: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // AUTH-006: Redis 缓存命中
  describe('AUTH-006: Redis Cache Hit', () => {
    it('should use cached API key info from Redis', async () => {
      const context = createMockContext('Bearer sk-cached-key');
      const keyHash = createHash('sha256')
        .update('sk-cached-key')
        .digest('hex');

      // Mock Redis cache hit
      const cachedData = JSON.stringify({
        tenantId: 'tenant-id',
        rateLimitConfig: {
          qpsLimit: 60,
          tpmLimit: 10000,
          concurrent: 5,
        },
      });
      redisService.get.mockResolvedValue(cachedData);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      // Database should not be queried
      expect(prismaService.apiKey.findFirst).not.toHaveBeenCalled();

      // Verify that request.user is populated from cache
      const request = context.switchToHttp().getRequest();
      expect(request.user).toBeDefined();
      expect(request.user.tenantId).toBe('tenant-id');
      expect(request.user.keyHash).toBe(keyHash);
    });
  });

  // AUTH-007: Redis 故障处理
  describe('AUTH-007: Redis Failure Handling', () => {
    it('should throw UnauthorizedException when Redis fails during get operation', async () => {
      const context = createMockContext('Bearer sk-test-key');

      // Mock Redis throws error during get
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication failed due to internal error',
      );
    });

    it('should throw UnauthorizedException when both Redis and DB fail', async () => {
      const context = createMockContext('Bearer sk-test-key');

      // Mock Redis throws error
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));

      // Mock database also throws error
      prismaService.apiKey.findFirst.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Authentication failed due to internal error',
      );
    });

    // NOTE: Known issue - Redis set failure currently blocks authentication
    // This should be fixed in a future PR to allow authentication to succeed
    // even if caching fails (since the key was already validated from DB)
  });
});
