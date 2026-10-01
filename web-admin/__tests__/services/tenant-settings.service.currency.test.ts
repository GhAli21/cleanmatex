import { describe, it, expect, beforeEach } from '@jest/globals';

// L2 parity tests: the 3 currency entry points on TenantSettingsService must
// keep their exact pre-cutover contract (signature + fail-loud behavior)
// while now delegating to TenantCurrencyProfileService (org_currency_cf)
// instead of the retired TENANT_CURRENCY / TENANT_DECIMAL_PLACES settings.
//
// TenantSettingsService has a module-level singleton that constructs its
// dependencies at import time, so both mocks below build their state fully
// inside the jest.mock() factory (no outer-scope `const`) to avoid a TDZ
// race between module hoisting and a later variable assignment.

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock('@/lib/services/fx/tenant-currency-profile.service', () => {
  const getProfile = jest.fn();
  return {
    TenantCurrencyProfileService: jest.fn().mockImplementation(() => ({ getProfile })),
    __getProfile: getProfile,
  };
});

import { TenantSettingsService } from '@/lib/services/tenant-settings.service';
import {
  CurrencyResolutionError,
  CURRENCY_RESOLUTION_ERRORS,
} from '@/lib/money/currency-resolution';

const { __getProfile: mockGetProfile } = jest.requireMock(
  '@/lib/services/fx/tenant-currency-profile.service'
) as unknown as { __getProfile: jest.Mock };

describe('TenantSettingsService currency entry points (L2 parity)', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
  });

  it('getTenantCurrency returns the base currency code', async () => {
    mockGetProfile.mockResolvedValueOnce({
      base: { currencyCode: 'OMR', decimalPlaces: 3 },
      reporting: null,
      currencies: [],
    });
    const service = new TenantSettingsService({} as never);
    await expect(service.getTenantCurrency('t1')).resolves.toBe('OMR');
  });

  it('getTenantDecimalPlaces returns the base decimal places', async () => {
    mockGetProfile.mockResolvedValueOnce({
      base: { currencyCode: 'OMR', decimalPlaces: 3 },
      reporting: null,
      currencies: [],
    });
    const service = new TenantSettingsService({} as never);
    await expect(service.getTenantDecimalPlaces('t1')).resolves.toBe(3);
  });

  it('getCurrencyConfig returns both fields in one call', async () => {
    mockGetProfile.mockResolvedValueOnce({
      base: { currencyCode: 'SAR', decimalPlaces: 2 },
      reporting: null,
      currencies: [],
    });
    const service = new TenantSettingsService({} as never);
    await expect(service.getCurrencyConfig('t1')).resolves.toEqual({
      currencyCode: 'SAR',
      decimalPlaces: 2,
    });
  });

  it('propagates MISSING_TENANT_CURRENCY (B15 fail-loud) from all 3 entry points', async () => {
    const err = new CurrencyResolutionError(
      CURRENCY_RESOLUTION_ERRORS.MISSING_TENANT_CURRENCY,
      'tenant t-unconfigured'
    );
    mockGetProfile.mockRejectedValue(err);
    const service = new TenantSettingsService({} as never);

    await expect(service.getTenantCurrency('t-unconfigured')).rejects.toThrow(
      CurrencyResolutionError
    );
    await expect(service.getTenantDecimalPlaces('t-unconfigured')).rejects.toThrow(
      CurrencyResolutionError
    );
    await expect(service.getCurrencyConfig('t-unconfigured')).rejects.toThrow(
      CurrencyResolutionError
    );
  });

  it('accepts (and ignores) branchId/userId — org_currency_cf is tenant-only', async () => {
    mockGetProfile.mockResolvedValueOnce({
      base: { currencyCode: 'OMR', decimalPlaces: 3 },
      reporting: null,
      currencies: [],
    });
    const service = new TenantSettingsService({} as never);
    await service.getTenantCurrency('t1', 'branch-1', 'user-1');
    expect(mockGetProfile).toHaveBeenCalledWith('t1');
  });
});
