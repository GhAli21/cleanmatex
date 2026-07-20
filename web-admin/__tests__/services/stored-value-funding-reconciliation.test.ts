/**
 * Tests: checkStoredValueFundingIntegrity (B3 reconciliation check)
 */

const mockTenderFindMany = jest.fn();
const mockVoucherFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_sv_funding_tenders_dtl: { findMany: (...a: unknown[]) => mockTenderFindMany(...a) },
    org_fin_vouchers_mst: { findMany: (...a: unknown[]) => mockVoucherFindMany(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { checkStoredValueFundingIntegrity } from '@/lib/services/reconciliation/stored-value-checks';

const TENANT = 'tenant-1';
const window = { periodFrom: new Date('2026-01-01'), periodTo: new Date('2026-12-31') };

describe('checkStoredValueFundingIntegrity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes (no issues) when no tender rows exist in the window', async () => {
    mockTenderFindMany.mockResolvedValue([]);
    const results = await checkStoredValueFundingIntegrity(TENANT, window);
    expect(results).toEqual([]);
    expect(mockVoucherFindMany).not.toHaveBeenCalled();
  });

  it('passes when the confirmed tender sum equals the voucher total', async () => {
    mockTenderFindMany.mockResolvedValue([
      { id: 't1', fin_voucher_id: 'v1', amount: 5, currency_code: 'OMR' },
      { id: 't2', fin_voucher_id: 'v1', amount: 15, currency_code: 'OMR' },
    ]);
    mockVoucherFindMany.mockResolvedValue([{ id: 'v1', total_amount: 20 }]);

    const results = await checkStoredValueFundingIntegrity(TENANT, window);
    expect(results).toEqual([]);
  });

  it('flags SV_FUNDING_TENDER_TOTAL_MATCH when the tender sum does not equal the voucher total', async () => {
    mockTenderFindMany.mockResolvedValue([{ id: 't1', fin_voucher_id: 'v1', amount: 12, currency_code: 'OMR' }]);
    mockVoucherFindMany.mockResolvedValue([{ id: 'v1', total_amount: 20 }]);

    const results = await checkStoredValueFundingIntegrity(TENANT, window);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      checkName: 'SV_FUNDING_TENDER_TOTAL_MATCH',
      severity: 'BLOCKER',
      passed: false,
      expectedValue: 20,
      actualValue: 12,
    });
  });

  it('flags SV_FUNDING_VOUCHER_LINK_EXISTS when the referenced voucher is missing', async () => {
    mockTenderFindMany.mockResolvedValue([{ id: 't1', fin_voucher_id: 'v-missing', amount: 20, currency_code: 'OMR' }]);
    mockVoucherFindMany.mockResolvedValue([]);

    const results = await checkStoredValueFundingIntegrity(TENANT, window);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ checkName: 'SV_FUNDING_VOUCHER_LINK_EXISTS', passed: false });
  });

  it('flags a currency mismatch across confirmed legs of the same voucher', async () => {
    mockTenderFindMany.mockResolvedValue([
      { id: 't1', fin_voucher_id: 'v1', amount: 10, currency_code: 'OMR' },
      { id: 't2', fin_voucher_id: 'v1', amount: 10, currency_code: 'USD' },
    ]);
    mockVoucherFindMany.mockResolvedValue([{ id: 'v1', total_amount: 20 }]);

    const results = await checkStoredValueFundingIntegrity(TENANT, window);
    expect(results).toHaveLength(1);
    expect(results[0].message).toMatch(/more than one currency/);
  });
});
