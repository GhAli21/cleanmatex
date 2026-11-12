/**
 * Jest setup - runs after test framework is installed
 */
jest.setTimeout(10000);

/**
 * Placeholder Supabase settings: some modules build the browser client when imported.
 * Unit tests never call it; a real value from the environment still wins.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

/** ERP-Lite services enforce `erp_lite_enabled` in production; unit tests mock the guard. */
jest.mock('@/lib/services/erp-lite-feature-guard', () => ({
  assertErpLiteEnabledForTenant: jest.fn().mockResolvedValue(undefined),
}));
