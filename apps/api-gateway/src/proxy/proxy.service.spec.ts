import { Test, TestingModule } from '@nestjs/testing';
import { ProxyService } from './proxy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('ProxyService', () => {
  let service: ProxyService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'LITELLM_API_BASE') return 'http://localhost:4000';
        if (key === 'LITELLM_MASTER_KEY') return 'test-key';
        return null;
      }),
    };

    const mockHttpService = {
      request: jest
        .fn()
        .mockReturnValue(of({ data: {}, status: 200, headers: {} })),
      get: jest
        .fn()
        .mockReturnValue(of({ data: {}, status: 200, headers: {} })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<ProxyService>(ProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
