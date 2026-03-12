import { Test, TestingModule } from '@nestjs/testing';
import { ProxyService } from './proxy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { RateLimitService } from '../modules/rate-limit/rate-limit.service';
import { of } from 'rxjs';

describe('ProxyService', () => {
  let service: ProxyService;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: RateLimitService, useValue: mockRateLimitService },
      ],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
