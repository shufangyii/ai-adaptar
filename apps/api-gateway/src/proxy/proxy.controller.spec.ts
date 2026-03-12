import { Test, TestingModule } from '@nestjs/testing';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { RateLimitService } from '../modules/rate-limit/rate-limit.service';
import { AuthGuard } from '../guards/auth.guard';
import { BalanceGuard } from '../guards/balance.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { DlpGuard } from '../guards/dlp.guard';
import { of } from 'rxjs';

describe('ProxyController', () => {
  let controller: ProxyController;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'LITELLM_API_BASE') return 'http://localhost:4000';
        if (key === 'LITELLM_MASTER_KEY') return 'test-key';
        if (key === 'UPSTREAM_TIMEOUT') return '30000';
        return null;
      }),
    };

    const mockHttpService = {
      axiosRef: {
        request: jest.fn().mockResolvedValue({
          data: {},
          status: 200,
          headers: {},
        }),
      },
      request: jest
        .fn()
        .mockReturnValue(of({ data: {}, status: 200, headers: {} })),
      get: jest
        .fn()
        .mockReturnValue(of({ data: {}, status: 200, headers: {} })),
    };

    const mockRateLimitService = {
      checkLimits: jest.fn().mockResolvedValue(true),
      releaseConnection: jest.fn().mockResolvedValue(undefined),
    };

    // Mock guards to always return true (allow all requests in unit tests)
    const mockGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        ProxyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: RateLimitService, useValue: mockRateLimitService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockGuard)
      .overrideGuard(BalanceGuard)
      .useValue(mockGuard)
      .overrideGuard(RateLimitGuard)
      .useValue(mockGuard)
      .overrideGuard(DlpGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ProxyController>(ProxyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
