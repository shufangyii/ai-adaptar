import { Test, TestingModule } from '@nestjs/testing';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('ProxyController', () => {
  let controller: ProxyController;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:4000'),
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
      controllers: [ProxyController],
      providers: [
        ProxyService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    controller = module.get<ProxyController>(ProxyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
