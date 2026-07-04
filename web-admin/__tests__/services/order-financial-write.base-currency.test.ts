/**
 * Multi-currency projection fixture (Remediation Phase 6, validation R-07) —
 * locks `projectBaseCurrencyAmount`, the single conversion used for all six
 * `base_cur_*` canonical columns (total / tax / paid / credit / outstanding /
 * AR receivable) in the snapshot recalc.
 */

import { projectBaseCurrencyAmount } from '@/lib/services/order-financial-write.service';

describe('projectBaseCurrencyAmount (base-currency projections)', () => {
  it('projects a non-1.0 exchange rate at 4-dp money precision (OMR→USD style)', () => {
    // rate 2.6008: 12.345 OMR → 32.1069 (rounded from 32.106876)
    expect(projectBaseCurrencyAmount(12.345, 2.6008)).toBe(32.1069);
  });

  it('is exact for rate 1 (single-currency tenants unchanged)', () => {
    expect(projectBaseCurrencyAmount(45.678, 1)).toBe(45.678);
  });

  it('rounds to 4 decimals, matching DECIMAL(19,4) storage', () => {
    expect(projectBaseCurrencyAmount(10.00005, 1)).toBe(10.0001);
    expect(projectBaseCurrencyAmount(0.26, 0.26)).toBe(0.0676);
  });

  it('projects 0 when the rate is missing/invalid — never a NaN write', () => {
    expect(projectBaseCurrencyAmount(100, 0)).toBe(0);
    expect(projectBaseCurrencyAmount(100, -1)).toBe(0);
    expect(projectBaseCurrencyAmount(100, Number.NaN)).toBe(0);
    expect(projectBaseCurrencyAmount(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('keeps the money identity total = paid + outstanding under projection', () => {
    const rate = 0.26;
    const total = 100.123;
    const paid = 60.1;
    const outstanding = total - paid;
    const projectedSum =
      projectBaseCurrencyAmount(paid, rate) + projectBaseCurrencyAmount(outstanding, rate);
    // per-component rounding may differ from projecting the sum by at most 1e-4
    expect(Math.abs(projectedSum - projectBaseCurrencyAmount(total, rate))).toBeLessThanOrEqual(
      0.0001
    );
  });
});
