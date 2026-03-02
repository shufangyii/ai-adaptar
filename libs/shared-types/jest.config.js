module.exports = {
  displayName: 'shared-types',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.d.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
