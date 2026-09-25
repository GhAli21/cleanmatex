/**
 * Jest setup - runs after test framework is installed
 */
jest.setTimeout(10000);

/** ERP-Lite services enforce `erp_lite_enabled` in production; unit tests mock the guard. */
jest.mock('@/lib/services/erp-lite-feature-guard', () => ({
  assertErpLiteEnabledForTenant: jest.fn().mockResolvedValue(undefined),
}));
