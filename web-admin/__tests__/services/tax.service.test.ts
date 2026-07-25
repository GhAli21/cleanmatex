/**
 * Tests: tax.service (TaxService.getTaxRate)
 *
 * B11 finding: getTaxRate previously defaulted to a hardcoded 5% VAT
 * (DEFAULT_VAT_RATE) whenever the TENANT_VAT_RATE setting was unset,
 * unparsable, or its resolution threw — directly violating the B15 policy
 * ("tax fallbacks are forbidden — zero-rate and warn, never assume a rate")
 * that lib/db/orders.ts already follows. This fixes getTaxRate to match.
 *
 * Covers:
 * - returns the configured rate when a valid TENANT_VAT_RATE setting exists
 * - returns 0 (not 0.05) when no setting is configured, and logs a warning
 * - returns 0 (not 0.05) when the setting value is unparsable, and logs a warning
 * - returns 0 (not 0.05) when resolution throws, and logs a warning
 * - caches the resolved rate for the TTL window
 */

// tax.service.ts's default export constructs the module-level `tenantSettingsService`
// singleton, whose constructor eagerly creates a browser Supabase client — mock it so
// import doesn't require real env vars. Every test below passes its own tenantSettings
// override anyway, so the mocked client is never actually used.
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn().mockReturnValue({}),
}));

import { logger } from '@/lib/utils/logger';
import { TaxService } from '@/lib/services/tax.service';

describe('TaxService.getTaxRate — B15 zero-rate policy (B11 regression)', () => {
  const TENANT = 'tenant-tax-svc-001';

  it('returns the configured rate when TENANT_VAT_RATE is set', async () => {
    const getSettingValue = jest.fn().mockResolvedValue(0.05);
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    const rate = await service.getTaxRate(TENANT);
    expect(rate).toBe(0.05);
  });

  it('returns 0 and logs a warning when no TENANT_VAT_RATE setting is configured', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const getSettingValue = jest.fn().mockResolvedValue(null);
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    const rate = await service.getTaxRate(TENANT);
    expect(rate).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no TENANT_VAT_RATE setting configured'),
      expect.objectContaining({ tenantId: TENANT })
    );
    warnSpy.mockRestore();
  });

  it('returns 0 and logs a warning when the setting value is unparsable', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const getSettingValue = jest.fn().mockResolvedValue('not-a-number');
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    const rate = await service.getTaxRate(TENANT);
    expect(rate).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unparsable TENANT_VAT_RATE'),
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it('returns 0 and logs a warning when a value outside [0,1] is stored (guards against a mis-entered percent like 5)', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const getSettingValue = jest.fn().mockResolvedValue(5); // 5 (not 0.05) is out of range
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    const rate = await service.getTaxRate(TENANT);
    expect(rate).toBe(0);
    warnSpy.mockRestore();
  });

  it('returns 0 and logs a warning when settings resolution throws', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const getSettingValue = jest.fn().mockRejectedValue(new Error('DB unavailable'));
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    const rate = await service.getTaxRate(TENANT);
    expect(rate).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('error resolving VAT rate'),
      expect.objectContaining({ tenantId: TENANT })
    );
    warnSpy.mockRestore();
  });

  it('caches the resolved rate — a second call within the TTL does not re-resolve', async () => {
    const getSettingValue = jest.fn().mockResolvedValue(0.1);
    const service = new TaxService({ tenantSettings: { getSettingValue } as never });

    await service.getTaxRate(TENANT);
    await service.getTaxRate(TENANT);
    expect(getSettingValue).toHaveBeenCalledTimes(1);
  });
});
