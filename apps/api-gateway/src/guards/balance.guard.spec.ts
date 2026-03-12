import { Test, TestingModule } from '@nestjs/testing';
import { BalanceGuard } from './balance.guard';
import { RedisService } from '@llm-gateway/redis';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

describe('BalanceGuard', () => {
  let guard: BalanceGuard;
  let redisService: jest.Mocked<RedisService>;

  // Helper function to create mock ExecutionContext
  const createMockContext = (tenantId?: string): ExecutionContext => {
    const mockRequest = {
      user: tenantId ? { tenantId, keyHash: 'test-hash' } : undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceGuard,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    guard = module.get<BalanceGuard>(BalanceGuard);
    redisService = module.get(RedisService) as jest.Mocked<RedisService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // COST-001: 余额低于安全水位
  describe('COST-001: Insufficient Balance', () => {
    it('should return 402 when balance is below threshold (negative)', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns negative balance
      redisService.get.mockResolvedValue('-10.5');

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: 'Insufficient balance. Please recharge your account.',
          status: HttpStatus.PAYMENT_REQUIRED,
        }),
      );
    });

    it('should return 402 when balance is exactly 0', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns zero balance
      redisService.get.mockResolvedValue('0');

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.PAYMENT_REQUIRED,
        }),
      );
    });

    it('should return 402 when balance is slightly below threshold', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns very small negative balance
      redisService.get.mockResolvedValue('-0.01');

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.PAYMENT_REQUIRED,
        }),
      );
    });
  });

  // COST-002: 余额正常
  describe('COST-002: Sufficient Balance', () => {
    it('should allow request when balance is sufficient', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns positive balance
      redisService.get.mockResolvedValue('100.50');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(
        'tenant:tenant-123:balance',
      );
    });

    it('should allow request when balance is very small but positive', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns very small positive balance
      redisService.get.mockResolvedValue('0.01');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request when balance is very large', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns large balance
      redisService.get.mockResolvedValue('999999.99');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // COST-003: Redis 中无余额数据 (Fail Open)
  describe('COST-003: Balance Not Found (Fail Open)', () => {
    it('should allow request when balance is not found in Redis', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns null (key not found)
      redisService.get.mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.get).toHaveBeenCalledWith(
        'tenant:tenant-123:balance',
      );
    });

    it('should allow request when balance is invalid number format', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns invalid number
      redisService.get.mockResolvedValue('invalid-number');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request when balance is empty string', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis returns empty string
      redisService.get.mockResolvedValue('');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // COST-004: Redis 连接失败 (Fail Open)
  describe('COST-004: Redis Connection Failure (Fail Open)', () => {
    it('should allow request when Redis connection fails', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis throws connection error
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request when Redis times out', async () => {
      const context = createMockContext('tenant-123');

      // Mock Redis throws timeout error
      redisService.get.mockRejectedValue(new Error('Redis timeout'));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // COST-005: 边界情况
  describe('COST-005: Edge Cases', () => {
    it('should allow request when request.user is undefined (Fail Open)', async () => {
      const context = createMockContext(); // No user

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Redis should not be queried
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should allow request when tenantId is missing (Fail Open)', async () => {
      const mockRequest = {
        user: { keyHash: 'test-hash' }, // No tenantId
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Redis should not be queried
      expect(redisService.get).not.toHaveBeenCalled();
    });
  });
});
