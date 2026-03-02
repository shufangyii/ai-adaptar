module.exports = {
  displayName: 'database',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.d.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
