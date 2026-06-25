const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
module.exports = createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/src/mocks/fetchMock.ts'],
  roots: ['<rootDir>/src'],
  // A large parallel coverage run can starve a worker's event loop, slowing (but
  // not breaking) the React Query async in the hook/page tests. The default 5s
  // per-test timeout is too tight under that contention; raise the ceiling so
  // slow-but-correct async is not failed spuriously. Healthy runs are unaffected
  // because assertions resolve as soon as their condition holds.
  testTimeout: 30000,
  // Cap workers so a coverage run does not oversubscribe the CPUs (the default is
  // cores-1). Oversubscription stalls a worker's event loop, which is what made
  // the React Query hook tests starve and hang; leaving headroom keeps every
  // worker's loop ticking so async settles promptly.
  maxWorkers: '50%',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/api/helpers.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/__tests__/**',
    '!src/mocks/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
});
