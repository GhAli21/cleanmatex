import { describe, it, expect, beforeEach } from '@jest/globals';

// The service module has a module-level singleton (`tenantCurrencyProfileService`)
// that calls createClient() at import time, so the mock client must be built
// fully inside the jest.mock() factory (no outer-scope reference) to avoid a
// TDZ race between module hoisting and a later `const` assignment.
jest.mock('@/lib/supabase/client', () => {
  const client = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  };
  return { createClient: jest.fn(() => client), __mockClient: client };
});

import { TenantCurrencyProfileService } from '@/lib/services/fx/tenant-currency-profile.service';
import { CurrencyResolutionError } from '@/lib/money/currency-resolution';

const { __mockClient: mockClient } = jest.requireMock('@/lib/supabase/client') as unknown as {
  __mockClient: {
    from: jest.Mock;
    select: jest.Mock;
    eq: jest.Mock;
    in: jest.Mock;
  };
};

/**
 * The org_currency_cf query chains 3 `.eq()` calls
 * (`tenant_org_id`, `rec_status`, `is_active`) before resolving — queue the
 * first two as pass-through (`this`) and only the 3rd (terminal) call as the
 * resolved value, since `.eq` is one shared mock across all 3 positions.
 */
function queueOrgCurrencyResult(result: { data: unknown; error: unknown }) {
  mockClient.eq.mockReturnValueOnce(mockClient);
  mockClient.eq.mockReturnValueOnce(mockClient);
  mockClient.eq.mockResolvedValueOnce(result);
}

describe('TenantCurrencyProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.from.mockReturnThis();
    mockClient.select.mockReturnThis();
    mockClient.eq.mockReturnThis();
    mockClient.in.mockReturnThis();
  });

  it('resolves the base currency and decimal places for a single-currency tenant', async () => {
    queueOrgCurrencyResult({
      data: [
        {
          currency_code: 'OMR',
          is_base_currency: true,
          is_reporting_currency: false,
          allow_sales: true,
          allow_payments: true,
          allow_cash: true,
          allow_ar: true,
        },
      ],
      error: null,
    });
    mockClient.in.mockResolvedValueOnce({
      data: [{ code: 'OMR', minor_unit: 3 }],
      error: null,
    });

    const service = new TenantCurrencyProfileService(mockClient as never);
    const profile = await service.getProfile('t1');

    expect(profile.base).toEqual({
      currencyCode: 'OMR',
      decimalPlaces: 3,
      isBaseCurrency: true,
      isReportingCurrency: false,
      allowSales: true,
      allowPayments: true,
      allowCash: true,
      allowAr: true,
    });
    expect(profile.reporting).toBeNull();
    expect(profile.currencies).toHaveLength(1);
  });

  it('separates the base row from a reporting row', async () => {
    queueOrgCurrencyResult({
      data: [
        {
          currency_code: 'OMR',
          is_base_currency: true,
          is_reporting_currency: false,
          allow_sales: true,
          allow_payments: true,
          allow_cash: true,
          allow_ar: true,
        },
        {
          currency_code: 'USD',
          is_base_currency: false,
          is_reporting_currency: true,
          allow_sales: false,
          allow_payments: false,
          allow_cash: false,
          allow_ar: false,
        },
      ],
      error: null,
    });
    mockClient.in.mockResolvedValueOnce({
      data: [
        { code: 'OMR', minor_unit: 3 },
        { code: 'USD', minor_unit: 2 },
      ],
      error: null,
    });

    const service = new TenantCurrencyProfileService(mockClient as never);
    const profile = await service.getProfile('t1');

    expect(profile.base.currencyCode).toBe('OMR');
    expect(profile.reporting?.currencyCode).toBe('USD');
    expect(profile.reporting?.decimalPlaces).toBe(2);
    expect(profile.currencies).toHaveLength(2);
  });

  it('fails loudly (MISSING_TENANT_CURRENCY) when no active base row exists', async () => {
    queueOrgCurrencyResult({ data: [], error: null });

    const service = new TenantCurrencyProfileService(mockClient as never);
    await expect(service.getProfile('t-unconfigured')).rejects.toThrow(CurrencyResolutionError);
  });

  it('fails loudly (MISSING_TENANT_CURRENCY) when the read errors', async () => {
    queueOrgCurrencyResult({ data: null, error: { message: 'boom' } });

    const service = new TenantCurrencyProfileService(mockClient as never);
    await expect(service.getProfile('t1')).rejects.toThrow(CurrencyResolutionError);
  });
});
