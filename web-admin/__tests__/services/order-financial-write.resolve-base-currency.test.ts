/**
 * L2 parity test — `resolveTenantBaseCurrencyCode` (Tenant_Currency_FX plan 01).
 * Cut over from the retired `TENANT_CURRENCY` HQ setting to `org_currency_cf`
 * (migration 0532); the function's signature and null-on-failure contract are
 * unchanged, only the source table is.
 */

const mockQueryRaw = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { resolveTenantBaseCurrencyCode } from '@/lib/services/order-financial-write.service';

describe('resolveTenantBaseCurrencyCode', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns the tenant base currency code from org_currency_cf', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ currency_code: 'OMR' }]);
    await expect(resolveTenantBaseCurrencyCode('t1')).resolves.toBe('OMR');
  });

  it('normalizes a lowercase code to uppercase', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ currency_code: 'sar' }]);
    await expect(resolveTenantBaseCurrencyCode('t1')).resolves.toBe('SAR');
  });

  it('returns null when the tenant has no base row', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(resolveTenantBaseCurrencyCode('t-unconfigured')).resolves.toBeNull();
  });

  it('returns null (never throws) when the query fails', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('db down'));
    await expect(resolveTenantBaseCurrencyCode('t1')).resolves.toBeNull();
  });
});
