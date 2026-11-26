/** Jest for @cmx/clock. Run through `npm test` (scripts/test-tz-matrix.mjs) for the TZ matrix. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: { warnOnly: false } }],
  },
  // The source imports temporal-polyfill (ESM only). Tests run against the built CommonJS bundle
  // through this mapper so the polyfill is already bundled; `npm test` builds first.
  moduleNameMapper: {
    '^@cmx/clock$': '<rootDir>/dist/index.cjs',
    '^@cmx/clock/zod$': '<rootDir>/dist/zod.cjs',
  },
};
