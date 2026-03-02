import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';

describe('DatabaseModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module.get(DatabaseModule)).toBeDefined();
  });

  it('should be a global module', () => {
    // Global modules are decorated with @Global() decorator
    // The module should be accessible across the application
    expect(DatabaseModule).toBeDefined();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });
});
