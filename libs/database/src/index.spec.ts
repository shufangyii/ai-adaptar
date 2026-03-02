import * as databaseModule from './database.module';

describe('Database Module Exports', () => {
  it('should export DatabaseModule', () => {
    expect(databaseModule.DatabaseModule).toBeDefined();
  });
});
