import * as redisModule from './redis.module';

describe('Redis Module Exports', () => {
  it('should export RedisModule', () => {
    expect(redisModule.RedisModule).toBeDefined();
  });
});
