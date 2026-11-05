/**
 * Tests: tax.service (TaxService)
 *
 * P6-03 retired the `TENANT_VAT_RATE` setting, `getTaxRate` and its rate
 * cache: the rate comes from tax profiles (`getDefaultVatRate`, tested in
 * tax-engine.service.test.ts). TaxService keeps only the amount helper.
 */
import { TaxService } from '@/lib/services/tax.service';

describe('TaxService', () => {
  it('rounds the tax amount to the tenant places', () => {
    expect(new TaxService().calculateTax(10.005, 0.05, 3)).toBe(0.5);
  });

  it('no longer reads a rate from settings', () => {
    expect('getTaxRate' in new TaxService()).toBe(false);
  });
});
