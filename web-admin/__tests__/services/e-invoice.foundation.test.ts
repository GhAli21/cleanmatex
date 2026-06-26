/**
 * F-05 / ADR-052 — e-invoicing foundation (pure logic).
 *
 * Covers the activation rule (disabled / before-start / on-or-after-start),
 * the fiscal-total validation foundation, and the V1 STANDARD-only tax
 * decomposition shape. No DB — these are pure functions.
 */
import {
  isEInvoiceActive,
  validateFiscalTotal,
  buildFoundationTaxDecomposition,
  buildTaxDecomposition,
  reconcileTaxDecomposition,
  resolveInitialEInvoiceStatus,
} from '@/lib/payments/e-invoice';
import { TAX_CATEGORY, E_INVOICE_STATUS } from '@/lib/constants/e-invoice';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';

describe('isEInvoiceActive — activation rule (ADR-052)', () => {
  it('disabled tenant is never active, even with a start date in the past', () => {
    expect(
      isEInvoiceActive({ isEnabled: false, startDate: '2026-01-01' }, '2026-07-01'),
    ).toBe(false);
  });

  it('enabled but missing start date is not active (defensive guard)', () => {
    expect(isEInvoiceActive({ isEnabled: true, startDate: null }, '2026-07-01')).toBe(false);
  });

  it('enabled but order is BEFORE the start date is not active', () => {
    expect(
      isEInvoiceActive({ isEnabled: true, startDate: '2026-07-01' }, '2026-06-30'),
    ).toBe(false);
  });

  it('enabled and order is exactly ON the start date is active', () => {
    expect(
      isEInvoiceActive({ isEnabled: true, startDate: '2026-07-01' }, '2026-07-01'),
    ).toBe(true);
  });

  it('enabled and order is AFTER the start date is active', () => {
    expect(
      isEInvoiceActive({ isEnabled: true, startDate: '2026-07-01' }, '2026-08-15'),
    ).toBe(true);
  });

  it('compares at calendar-date granularity (time-of-day on the start date is ignored)', () => {
    // Order at 23:59 UTC on the start date still counts as on/after the date.
    expect(
      isEInvoiceActive(
        { isEnabled: true, startDate: new Date('2026-07-01T00:00:00.000Z') },
        new Date('2026-07-01T23:59:59.000Z'),
      ),
    ).toBe(true);
  });

  it('returns false for an unparseable order date', () => {
    expect(isEInvoiceActive({ isEnabled: true, startDate: '2026-07-01' }, 'not-a-date')).toBe(
      false,
    );
  });
});

describe('validateFiscalTotal — fiscal-total reconciliation foundation', () => {
  it('passes when the tax-document total equals the order total', () => {
    const r = validateFiscalTotal(100, 100);
    expect(r.ok).toBe(true);
    expect(r.difference).toBe(0);
  });

  it('passes within the money epsilon', () => {
    // Strictly inside the 0.001 tolerance (avoids float-boundary noise).
    const r = validateFiscalTotal(100.0005, 100);
    expect(r.ok).toBe(true);
    expect(r.epsilon).toBe(SETTLEMENT_MONEY_EPSILON);
  });

  it('fails beyond the epsilon and reports the signed difference', () => {
    const r = validateFiscalTotal(100.5, 100);
    expect(r.ok).toBe(false);
    expect(r.difference).toBeCloseTo(0.5, 6);
  });
});

describe('buildFoundationTaxDecomposition — V1 STANDARD passthrough', () => {
  it('routes the whole taxable base through STANDARD and zeroes the rest', () => {
    const d = buildFoundationTaxDecomposition(250);
    expect(d[TAX_CATEGORY.STANDARD]).toBe(250);
    expect(d[TAX_CATEGORY.EXEMPT]).toBe(0);
    expect(d[TAX_CATEGORY.ZERO_RATED]).toBe(0);
    expect(d[TAX_CATEGORY.OUT_OF_SCOPE]).toBe(0);
  });

  it('produces a full bucket shape that sums back to the taxable base', () => {
    const d = buildFoundationTaxDecomposition(99.99);
    expect(Object.keys(d).sort()).toEqual(
      [
        TAX_CATEGORY.EXEMPT,
        TAX_CATEGORY.OUT_OF_SCOPE,
        TAX_CATEGORY.STANDARD,
        TAX_CATEGORY.ZERO_RATED,
      ].sort(),
    );
    const sum = Object.values(d).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(99.99, 6);
  });

  it('delegates to buildTaxDecomposition (identical shape for a STANDARD-only base)', () => {
    expect(buildFoundationTaxDecomposition(250)).toEqual(
      buildTaxDecomposition({ standard: 250, exempt: 0, zeroRated: 0, outOfScope: 0 }),
    );
  });
});

describe('buildTaxDecomposition — real per-category decomposition (F-05 completion)', () => {
  it('emits each category from its own base (mixed-category order)', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
    expect(d[TAX_CATEGORY.STANDARD]).toBe(100);
    expect(d[TAX_CATEGORY.EXEMPT]).toBe(20);
    expect(d[TAX_CATEGORY.ZERO_RATED]).toBe(30);
    expect(d[TAX_CATEGORY.OUT_OF_SCOPE]).toBe(5);
  });

  it('clamps negative / non-finite bases to zero', () => {
    const d = buildTaxDecomposition({ standard: -10, exempt: Number.NaN, zeroRated: 30, outOfScope: 0 });
    expect(d[TAX_CATEGORY.STANDARD]).toBe(0);
    expect(d[TAX_CATEGORY.EXEMPT]).toBe(0);
    expect(d[TAX_CATEGORY.ZERO_RATED]).toBe(30);
  });
});

describe('reconcileTaxDecomposition — Σbuckets vs expected base', () => {
  it('passes when the buckets sum to the expected base', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
    const r = reconcileTaxDecomposition(d, 155);
    expect(r.ok).toBe(true);
    expect(r.difference).toBeCloseTo(0, 6);
  });

  it('passes within the money epsilon', () => {
    const d = buildTaxDecomposition({ standard: 100.0005, exempt: 0, zeroRated: 0, outOfScope: 0 });
    expect(reconcileTaxDecomposition(d, 100).ok).toBe(true);
  });

  it('fails and reports the signed difference when buckets drift from the base', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 0, zeroRated: 0, outOfScope: 0 });
    const r = reconcileTaxDecomposition(d, 90);
    expect(r.ok).toBe(false);
    expect(r.difference).toBeCloseTo(10, 6); // Σbuckets(100) - expected(90)
  });
});

describe('resolveInitialEInvoiceStatus — tax-doc initial status (mig 0386)', () => {
  it('active order → PENDING', () => {
    expect(resolveInitialEInvoiceStatus(true)).toBe(E_INVOICE_STATUS.PENDING);
  });
  it('inactive order → NOT_APPLICABLE', () => {
    expect(resolveInitialEInvoiceStatus(false)).toBe(E_INVOICE_STATUS.NOT_APPLICABLE);
  });
});
