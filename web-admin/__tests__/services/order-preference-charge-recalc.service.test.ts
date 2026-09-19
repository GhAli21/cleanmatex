import { TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import { previewPreferenceChargeCorrection } from '@/lib/services/order-preference-charge-recalc.service';

describe('previewPreferenceChargeCorrection', () => {
  it('drops contaminating ITEM/PIECE charges from the proposed total without touching paid', () => {
    const result = previewPreferenceChargeCorrection({
      currentTotal: 10.2,
      itemsBaseAmount: 9.5,
      moneyAddendCharges: 0,
      totalDiscountAmount: 0,
      totalTaxAmount: 0,
      roundingAdjustmentAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
      totalPaidAmount: 5,
      totalCreditAppliedAmount: 0,
      contaminatingChargeAmount: 0.7,
    });

    expect(result.proposedTotal).toBeCloseTo(9.5);
    expect(result.currentOutstanding).toBeCloseTo(5.2);
    expect(result.proposedOutstanding).toBeCloseTo(4.5);
    expect(result.delta).toBeCloseTo(-0.7);
  });

  it('keeps ORDER-level money addends in the proposed total', () => {
    const result = previewPreferenceChargeCorrection({
      currentTotal: 11.5,
      itemsBaseAmount: 9.5,
      moneyAddendCharges: 2,
      totalDiscountAmount: 0,
      totalTaxAmount: 0,
      roundingAdjustmentAmount: 0,
      taxPricingMode: TAX_PRICING_MODES.TAX_INCLUSIVE,
      totalPaidAmount: 1,
      totalCreditAppliedAmount: 0,
      contaminatingChargeAmount: 0.7,
    });

    expect(result.proposedTotal).toBeCloseTo(11.5);
  });
});
