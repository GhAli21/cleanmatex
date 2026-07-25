/**
 * Integration: B11 — preview == submit == snapshot tax-inclusive consistency.
 *
 * calculateOrderTotals (preview + submit, order-calculation.service.ts) computes
 * taxBreakdown via calculateTax (tax-engine.service.ts); settleOrderTx persists
 * those same lines into org_order_taxes_dtl. The recalculation snapshot later
 * re-derives the header total from persisted rows via resolveCanonicalTotalAmount
 * (order-financial-write.service.ts), using:
 *   - itemsBaseAmount = SUM(org_order_items_dtl.total_price) — the raw catalog
 *     price, which B11 deliberately never rewrites (still tax-inclusive gross
 *     for TAX_INCLUSIVE tenants — see B11 Scope: item-level pricing is untouched).
 *   - totalTaxAmount  = SUM(org_order_taxes_dtl.tax_amount) — now correctly the
 *     EXTRACTED tax, not the previously-missing/added figure.
 *
 * This proves the two ends of that pipe agree: the extracted tax lines
 * calculateOrderTotals now returns, combined with the untouched item gross,
 * reconstruct through resolveCanonicalTotalAmount's taxAddend=0 formula to the
 * exact same total calculateOrderTotals's own saleTotal reports.
 */

const mockTaxProfileFindMany = jest.fn();
const mockTaxExemptionFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tax_profiles_cf:   { findMany: (...a: unknown[]) => mockTaxProfileFindMany(...a) },
    org_tax_exemptions_cf: { findFirst: (...a: unknown[]) => mockTaxExemptionFindFirst(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { calculateTax } from '@/lib/services/tax-engine.service';
import { resolveCanonicalTotalAmount } from '@/lib/services/order-financial-write.service';
import { TAX_PRICING_MODES } from '@/lib/constants/order-financial';

const TENANT = 'tenant-b11-int-001';

const vatProfile = {
  id: 'p1',
  tenant_org_id: TENANT,
  name: 'VAT',
  name2: null,
  tax_type: 'VAT',
  rate: 5,
  is_compound: false,
  is_default: true,
  is_active: true,
  rec_status: 1,
  applies_to: [],
};

describe('B11 — preview/submit/snapshot tax-inclusive consistency', () => {
  beforeEach(() => jest.clearAllMocks());

  it('TAX_INCLUSIVE: header total from persisted rows equals the original inclusive gross — tax is not re-added', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue(null);
    mockTaxProfileFindMany.mockResolvedValue([vatProfile]);

    // e.g. two items priced at 105 gross each. B11 never rewrites item.total_price,
    // so the DB aggregate stays this raw (tax-inclusive) figure.
    const inclusiveGross = 210;
    const itemsBaseAmount = inclusiveGross;

    // What calculateOrderTotals (preview + submit) computes and settleOrderTx
    // persists into org_order_taxes_dtl.
    const taxLines = await calculateTax({
      tenantId: TENANT,
      baseAmount: inclusiveGross,
      decimalPlaces: 4,
      pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
    });
    const totalTaxAmount = taxLines.reduce((sum, l) => sum + l.taxAmount, 0);
    // Sanity: the embedded tax was genuinely extracted (not silently zero).
    expect(totalTaxAmount).toBeCloseTo(10, 3);

    // The exact formula the recalculation snapshot uses to derive the header
    // total from those persisted rows.
    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount,
      roundingAdjustmentAmount: 0,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
    });

    expect(totalAmount).toBeCloseTo(inclusiveGross, 3);
    // Regression guard: if the taxAddend=0 branch were ever dropped, this naive
    // sum would overcount an already-inclusive gross by the embedded tax.
    expect(itemsBaseAmount + totalTaxAmount).toBeGreaterThan(inclusiveGross);
  });

  it('TAX_EXCLUSIVE: the same formula adds tax on top — byte-identical to pre-B11 behavior', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue(null);
    mockTaxProfileFindMany.mockResolvedValue([vatProfile]);

    const netBase = 200; // exclusive: item.total_price IS the net taxable base
    const taxLines = await calculateTax({
      tenantId: TENANT,
      baseAmount: netBase,
      decimalPlaces: 4,
      pricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
    });
    const totalTaxAmount = taxLines.reduce((sum, l) => sum + l.taxAmount, 0);
    expect(totalTaxAmount).toBeCloseTo(10, 3);

    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount: netBase,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount,
      roundingAdjustmentAmount: 0,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
    });

    expect(totalAmount).toBeCloseTo(210, 3); // 200 net + 5% VAT on top = 210
  });

  it('TAX_INCLUSIVE with a compound tax stack: extraction still nets out to zero double-count', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue(null);
    mockTaxProfileFindMany.mockResolvedValue([
      { ...vatProfile, id: 'p1', rate: 5, is_compound: false },
      { ...vatProfile, id: 'p2', tax_type: 'CUSTOM', rate: 3, is_compound: true },
    ]);

    // net=100 => tax1=5, compound base=105 => tax2=3.15 => gross=108.15
    const inclusiveGross = 108.15;
    const taxLines = await calculateTax({
      tenantId: TENANT,
      baseAmount: inclusiveGross,
      decimalPlaces: 4,
      pricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
    });
    const totalTaxAmount = taxLines.reduce((sum, l) => sum + l.taxAmount, 0);
    expect(totalTaxAmount).toBeCloseTo(8.15, 2);

    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount: inclusiveGross, // item.total_price, untouched by B11
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount,
      roundingAdjustmentAmount: 0,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
    });

    expect(totalAmount).toBeCloseTo(inclusiveGross, 2);
  });
});
