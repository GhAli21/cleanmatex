/**
 * Jest config — DB-level finance integration harness (F-T5 / T-1).
 *
 * Separate from the default jsdom unit suite (jest.config.js): this runs in a Node
 * environment against a REAL Postgres (local Supabase) with all migrations applied,
 * exercising live CHECK / FK / RLS invariants that the mocked-Prisma unit tests can
 * never reach — the structural gap that let the wallet-CHECK blocker (F-00) ship.
 *
 * Run with:  npm run test:db-integration
 * The default `npm test` ignores __tests__/db-integration (see jest.config.js).
 * If no DB is reachable, the suite skips gracefully (see the harness beforeAll).
 */
const nextJest = require('next/jest');

// Reuse next/jest so .env / .env.local (DATABASE_URL) load and ts-jest + @/ aliases work.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const dbJestConfig = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/db-integration'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  testTimeout: 30000,
  verbose: true,
};

module.exports = createJestConfig(dbJestConfig);
