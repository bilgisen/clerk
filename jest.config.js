module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^(\.{1,2}/.*)\\.js$': '$1',
    '^(\.{1,2}/.*)\\.ts$': '$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      sourceMaps: 'inline',
      module: {
        type: 'es6',
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose|jose/.*|uuid|@jose/.*|@panva/.*)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
    },
  },
  setupFiles: ['<rootDir>/.jest/set-env-vars.js'],
  setupFilesAfterEnv: ['<rootDir>/.jest/setup-tests.ts'],
  testTimeout: 30000,
};
