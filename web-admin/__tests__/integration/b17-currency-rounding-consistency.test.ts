/**
 * Integration: B17 — preview == submit == snapshot rounding-adjustment consistency.
 *
 * calculateOrderTotals (preview + submit) resolves the currency rounding rule
 * via resolveCurrencyRoundingRule + roundToIncrement (lib/money/currency-rounding.ts)
 * and persists the delta into org_orders_mst.rounding_adjustment_amount. The
 * recalculation snapshot later re-derives the header total from that same
 * persisted column via resolveCanonicalTotalAmount's `+ roundingAdjustmentAmount`
 * term (order-financial-write.service.ts). This proves both ends of that pipe
 * agree: the real rounding-rule resolution + increment math produces a delta
 * that, once persisted and fed back through the exact snapshot formula,
 * reconstructs the correct rounded grand total.
 */

const mockFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_currency_rounding_rules_cd: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
  },
}));

import { resolveCurrencyRoundingRule, roundToIncrement } from '@/lib/money/currency-rounding';
import { resolveCanonicalTotalAmount } from '@/lib/services/order-financial-write.service';
import { TAX_PRICING_MODES } from '@/lib/constants/order-financial';

describe('B17 — preview/submit/snapshot currency-rounding consistency', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a non-native rounding rule persists a delta that reconstructs the exact rounded grand total', async () => {
    mockFindFirst.mockResolvedValue({
      currency_code: 'OMR',
      rounding_method: 'HALF_UP',
      rounding_unit: 0.005,
      is_active: true,
      rec_status: 1,
    });

    // What calculateOrderTotals computes pre-rounding (items + tax, no charges/discounts).
    const preRoundingGrandTotal = 12.343;

    const rule = await resolveCurrencyRoundingRule('OMR');
    expect(rule).not.toBeNull();
    const roundedTotal = roundToIncrement(preRoundingGrandTotal, rule!.roundingUnit, rule!.roundingMethod);
    const roundingAdjustmentAmount = Number((roundedTotal - preRoundingGrandTotal).toFixed(3));

    expect(roundedTotal).toBeCloseTo(12.345, 3);
    expect(roundingAdjustmentAmount).toBeCloseTo(0.002, 3);

    // This is exactly what gets persisted to org_orders_mst.rounding_adjustment_amount
    // at submit, and exactly what the recalculation snapshot later re-reads.
    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount: preRoundingGrandTotal,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount: 0,
      roundingAdjustmentAmount,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
    });

    expect(totalAmount).toBeCloseTo(roundedTotal, 3);
    expect(totalAmount).toBeCloseTo(12.345, 3);
  });

  it('no active rule -> zero adjustment -> snapshot total equals the unrounded figure (regression: byte-identical to pre-B17)', async () => {
    mockFindFirst.mockResolvedValue(null);

    const preRoundingGrandTotal = 12.343;
    const rule = await resolveCurrencyRoundingRule('XYZ');
    expect(rule).toBeNull();

    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount: preRoundingGrandTotal,
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount: 0,
      roundingAdjustmentAmount: 0,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
    });

    expect(totalAmount).toBeCloseTo(preRoundingGrandTotal, 3);
  });

  it('a TAX_INCLUSIVE order with a rounding adjustment combines both terms correctly (B11+B17)', async () => {
    mockFindFirst.mockResolvedValue({
      currency_code: 'SAR',
      rounding_method: 'HALF_UP',
      rounding_unit: 0.05,
      is_active: true,
      rec_status: 1,
    });

    // Inclusive order: net=100, tax=15 extracted -> gross=115; rounding rule
    // nudges the gross to the nearest 0.05 (already exact here, so 0 delta) —
    // then perturb by 0.01 to exercise a genuine non-zero inclusive+rounding case.
    const inclusiveGross = 115.01;
    const rule = await resolveCurrencyRoundingRule('SAR');
    const roundedGross = roundToIncrement(inclusiveGross, rule!.roundingUnit, rule!.roundingMethod);
    const roundingAdjustmentAmount = Number((roundedGross - inclusiveGross).toFixed(3));

    expect(roundedGross).toBeCloseTo(115.0, 3);
    expect(roundingAdjustmentAmount).toBeCloseTo(-0.01, 3);

    const { totalAmount } = resolveCanonicalTotalAmount({
      itemsBaseAmount: inclusiveGross, // item.total_price, untouched by B11
      totalChargesAmount: 0,
      totalDiscountAmount: 0,
      totalTaxAmount: 15, // extracted VAT — already embedded, taxAddend=0 under inclusive
      roundingAdjustmentAmount,
      headerTotalAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
    });

    // inclusive: itemsBaseAmount + 0(taxAddend) + roundingAdjustmentAmount
    expect(totalAmount).toBeCloseTo(roundedGross, 3);
  });
});
