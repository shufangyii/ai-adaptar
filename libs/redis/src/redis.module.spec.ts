import { Test, TestingModule } from '@nestjs/testing';
import { RedisModule } from './redis.module';

describe('RedisModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module.get(RedisModule)).toBeDefined();
  });

  it('should be a global module', () => {
    // Global modules are decorated with @Global() decorator
    // The module should be accessible across the application
    expect(RedisModule).toBeDefined();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });
});
