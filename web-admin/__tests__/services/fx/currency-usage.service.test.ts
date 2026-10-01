/**
 * Tests: currency-usage.service (C4 guard, Tenant_Currency_FX plan 01 §4.1).
 * Covers: each usage reason fires independently, tenant isolation, and the
 * "clean" (not in use) path.
 */

const mockOrdersCount = jest.fn();
const mockInvoicesCount = jest.fn();
const mockWalletsCount = jest.fn();
const mockGiftCardsCount = jest.fn();
const mockAdvancesCount = jest.fn();
const mockDrawerSessionsCount = jest.fn();
const mockDrawersCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: { count: (...a: unknown[]) => mockOrdersCount(...a) },
    org_invoice_mst: { count: (...a: unknown[]) => mockInvoicesCount(...a) },
    org_customer_wallets_mst: { count: (...a: unknown[]) => mockWalletsCount(...a) },
    org_gift_cards_mst: { count: (...a: unknown[]) => mockGiftCardsCount(...a) },
    org_customer_advances_mst: { count: (...a: unknown[]) => mockAdvancesCount(...a) },
    org_cash_drawer_sessions_mst: { count: (...a: unknown[]) => mockDrawerSessionsCount(...a) },
    org_cash_drawers_mst: { count: (...a: unknown[]) => mockDrawersCount(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

import { checkCurrencyInUse } from '@/lib/services/fx/currency-usage.service';
import { CURRENCY_USAGE_REASON } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CCY = 'USD';

function mockAllCountsZero() {
  mockOrdersCount.mockResolvedValue(0);
  mockInvoicesCount.mockResolvedValue(0);
  mockWalletsCount.mockResolvedValue(0);
  mockGiftCardsCount.mockResolvedValue(0);
  mockAdvancesCount.mockResolvedValue(0);
  mockDrawerSessionsCount.mockResolvedValue(0);
  mockDrawersCount.mockResolvedValue(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAllCountsZero();
});

describe('currency-usage.service — checkCurrencyInUse', () => {
  it('reports not in use when every check is zero', async () => {
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result).toEqual({ inUse: false, reasons: [] });
  });

  it('flags OPEN_ORDERS when open orders exist in that currency', async () => {
    mockOrdersCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.inUse).toBe(true);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.OPEN_ORDERS]);
  });

  it('flags OPEN_AR when open AR invoices exist', async () => {
    mockInvoicesCount.mockResolvedValue(2);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.OPEN_AR]);
  });

  it('flags NONZERO_WALLET_BALANCE when a wallet has a nonzero balance', async () => {
    mockWalletsCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.NONZERO_WALLET_BALANCE]);
  });

  it('flags NONZERO_GIFT_CARD_BALANCE when a gift card has a nonzero balance', async () => {
    mockGiftCardsCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.NONZERO_GIFT_CARD_BALANCE]);
  });

  it('flags NONZERO_ADVANCE_BALANCE when a customer advance has a nonzero balance', async () => {
    mockAdvancesCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.NONZERO_ADVANCE_BALANCE]);
  });

  it('flags OPEN_DRAWER_SESSIONS when a drawer session is open in that currency', async () => {
    mockDrawerSessionsCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.OPEN_DRAWER_SESSIONS]);
  });

  it('flags ACTIVE_DRAWERS when an active drawer exists in that currency', async () => {
    mockDrawersCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.reasons).toEqual([CURRENCY_USAGE_REASON.ACTIVE_DRAWERS]);
  });

  it('returns every matching reason at once, not just the first', async () => {
    mockOrdersCount.mockResolvedValue(1);
    mockDrawersCount.mockResolvedValue(1);
    const result = await checkCurrencyInUse(TENANT_ID, CCY);
    expect(result.inUse).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining([CURRENCY_USAGE_REASON.OPEN_ORDERS, CURRENCY_USAGE_REASON.ACTIVE_DRAWERS])
    );
    expect(result.reasons).toHaveLength(2);
  });

  it('scopes every check by tenant_org_id and currency_code (tenant isolation)', async () => {
    await checkCurrencyInUse(TENANT_ID, CCY);

    for (const mock of [
      mockOrdersCount,
      mockInvoicesCount,
      mockWalletsCount,
      mockGiftCardsCount,
      mockAdvancesCount,
      mockDrawerSessionsCount,
      mockDrawersCount,
    ]) {
      const where = mock.mock.calls[0][0].where;
      expect(where.tenant_org_id).toBe(TENANT_ID);
      expect(where.currency_code).toBe(CCY);
    }
  });
});
