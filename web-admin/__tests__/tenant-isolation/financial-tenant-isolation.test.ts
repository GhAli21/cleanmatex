/**
 * Tests: financial-tenant-isolation
 *
 * Verifies that all financial service functions filter by tenant_org_id
 * and do NOT return cross-tenant data.
 *
 * Approach:
 * - Mock prisma so Tenant A's queries return data, Tenant B's return empty
 * - Call service with Tenant B's ID → verify no data leaks from Tenant A
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';

// Tenant-aware mock: only returns data for TENANT_A
const tenantAwareFind = (tenantId: string, tenantAData: unknown) =>
  jest.fn().mockImplementation((args: { where?: { tenant_org_id?: string } }) => {
    if (args?.where?.tenant_org_id === tenantId) return Promise.resolve(tenantAData);
    return Promise.resolve(null);
  });

const tenantAwareFindMany = (tenantId: string, tenantAData: unknown[]) =>
  jest.fn().mockImplementation((args: { where?: { tenant_org_id?: string } }) => {
    if (args?.where?.tenant_org_id === tenantId) return Promise.resolve(tenantAData);
    return Promise.resolve([]);
  });

const mockLoyaltyProgramFindFirst = tenantAwareFind(TENANT_A, {
  id: 'prog-A', tenant_org_id: TENANT_A, earn_rate: 1,
});

const mockLoyaltyAccountFindFirst = tenantAwareFind(TENANT_A, {
  id: 'acct-A', tenant_org_id: TENANT_A, points_balance: 100,
});

const mockWalletFindFirst = tenantAwareFind(TENANT_A, {
  id: 'w-A', tenant_org_id: TENANT_A, balance: 500, currency_code: 'OMR',
});

const mockDrawerFindMany = tenantAwareFindMany(TENANT_A, [
  { id: 'drawer-A', tenant_org_id: TENANT_A },
]);

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_loyalty_programs_cf:  { findFirst: (...a: unknown[]) => mockLoyaltyProgramFindFirst(...a) },
    org_loyalty_accounts_mst: { findFirst: (...a: unknown[]) => mockLoyaltyAccountFindFirst(...a) },
    org_customer_wallets_mst: { findFirst: (...a: unknown[]) => mockWalletFindFirst(...a) },
    org_cash_drawers_mst:     { findMany:  (...a: unknown[]) => mockDrawerFindMany(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import { getLoyaltyConfig, getLoyaltyAccount } from '@/lib/services/loyalty.service';
import { getWalletBalance }                     from '@/lib/services/stored-value.service';
import { getDrawers }                           from '@/lib/services/cash-drawer.service';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('financial-tenant-isolation — loyalty', () => {
  it('getLoyaltyConfig returns data for TENANT_A', async () => {
    const result = await getLoyaltyConfig(TENANT_A);
    expect(result).not.toBeNull();
    expect((result as { tenant_org_id: string }).tenant_org_id).toBe(TENANT_A);
  });

  it('getLoyaltyConfig returns null for TENANT_B (no cross-tenant leak)', async () => {
    const result = await getLoyaltyConfig(TENANT_B);
    expect(result).toBeNull();
  });

  it('getLoyaltyAccount returns data for TENANT_A', async () => {
    const result = await getLoyaltyAccount(TENANT_A, 'cust-1');
    expect(result).not.toBeNull();
  });

  it('getLoyaltyAccount returns null for TENANT_B', async () => {
    const result = await getLoyaltyAccount(TENANT_B, 'cust-1');
    expect(result).toBeNull();
  });
});

describe('financial-tenant-isolation — stored value', () => {
  it('getWalletBalance returns balance for TENANT_A', async () => {
    const result = await getWalletBalance(TENANT_A, 'cust-A');
    expect(result.balance).toBeGreaterThan(0);
    expect(result.walletId).toBe('w-A');
  });

  it('getWalletBalance returns zero balance for TENANT_B (no cross-tenant leak)', async () => {
    const result = await getWalletBalance(TENANT_B, 'cust-A');
    expect(result.balance).toBe(0);
    expect(result.walletId).toBeNull();
  });
});

describe('financial-tenant-isolation — cash drawers', () => {
  it('getDrawers returns drawers for TENANT_A', async () => {
    const result = await getDrawers(TENANT_A);
    expect(result.length).toBeGreaterThan(0);
  });

  it('getDrawers returns empty array for TENANT_B (no cross-tenant leak)', async () => {
    const result = await getDrawers(TENANT_B);
    expect(result).toEqual([]);
  });
});
