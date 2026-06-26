/**
 * F-05 §8 — ZATCA jurisdiction adapter (pure).
 *
 * Locks the decomposition → ZATCA document mapping: category codes, per-category
 * tax (standard rate on S only; 0 on E/Z/O), reconciled totals, and required fields.
 */
import { buildZatcaDocument, ZATCA_TAX_CATEGORY_CODES } from '@/lib/payments/adapters/zatca.adapter';
import { buildTaxDecomposition } from '@/lib/payments/e-invoice';
import { TAX_CATEGORY } from '@/lib/constants/e-invoice';

const ctx = {
  invoiceNo: 'INV-2026-000123',
  issueDate: '2026-07-01',
  supplierVatNumber: '300000000000003',
  buyerVatNumber: '311111111111113',
  currency: 'SAR',
  standardRatePercent: 15,
};

describe('ZATCA category code mapping', () => {
  it('maps the canonical categories to S/E/Z/O', () => {
    expect(ZATCA_TAX_CATEGORY_CODES[TAX_CATEGORY.STANDARD]).toBe('S');
    expect(ZATCA_TAX_CATEGORY_CODES[TAX_CATEGORY.EXEMPT]).toBe('E');
    expect(ZATCA_TAX_CATEGORY_CODES[TAX_CATEGORY.ZERO_RATED]).toBe('Z');
    expect(ZATCA_TAX_CATEGORY_CODES[TAX_CATEGORY.OUT_OF_SCOPE]).toBe('O');
  });
});

describe('buildZatcaDocument', () => {
  it('standard-only order → one S line at the standard rate', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 0, zeroRated: 0, outOfScope: 0 });
    const doc = buildZatcaDocument(d, ctx);

    expect(doc.lineItems).toHaveLength(1);
    expect(doc.lineItems[0]).toEqual({ taxCategory: 'S', taxableAmount: 100, taxAmount: 15, taxPercent: 15 });
    expect(doc.totalTaxableAmount).toBe(100);
    expect(doc.totalTaxAmount).toBe(15);
    expect(doc.totalWithTax).toBe(115);
  });

  it('mixed-category order → one line per applicable category, tax only on S', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
    const doc = buildZatcaDocument(d, ctx);

    expect(doc.lineItems).toHaveLength(4);
    const byCat = Object.fromEntries(doc.lineItems.map((l) => [l.taxCategory, l]));
    expect(byCat.S.taxAmount).toBe(15); // 100 * 15%
    expect(byCat.E.taxAmount).toBe(0);
    expect(byCat.Z.taxAmount).toBe(0);
    expect(byCat.O.taxAmount).toBe(0);
    expect(byCat.E.taxPercent).toBe(0);
  });

  it('omits categories with a zero base (only applicable groups appear)', () => {
    const d = buildTaxDecomposition({ standard: 0, exempt: 50, zeroRated: 0, outOfScope: 0 });
    const doc = buildZatcaDocument(d, ctx);
    expect(doc.lineItems.map((l) => l.taxCategory)).toEqual(['E']);
    expect(doc.totalTaxAmount).toBe(0);
  });

  it('reconciles totals: totalWithTax === totalTaxableAmount + totalTaxAmount', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
    const doc = buildZatcaDocument(d, ctx);
    expect(doc.totalTaxableAmount).toBeCloseTo(155, 5);
    expect(doc.totalWithTax).toBeCloseTo(doc.totalTaxableAmount + doc.totalTaxAmount, 5);
  });

  it('carries the required identity fields through', () => {
    const d = buildTaxDecomposition({ standard: 100, exempt: 0, zeroRated: 0, outOfScope: 0 });
    const doc = buildZatcaDocument(d, ctx);
    expect(doc).toMatchObject({
      invoiceNo: 'INV-2026-000123',
      issueDate: '2026-07-01',
      supplierVatNumber: '300000000000003',
      buyerVatNumber: '311111111111113',
      currency: 'SAR',
    });
  });

  it('rounds tax to the configured precision', () => {
    // 33.333 * 15% = 4.99995 → 5.00 at 2dp
    const d = buildTaxDecomposition({ standard: 33.333, exempt: 0, zeroRated: 0, outOfScope: 0 });
    const doc = buildZatcaDocument(d, ctx);
    expect(doc.lineItems[0].taxAmount).toBe(5);
  });
});
