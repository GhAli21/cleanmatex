import {
  computeNeedsAdvanced,
  NEEDS_ADVANCED_REASON,
} from '@features/orders/hooks/payment-needs-advanced';
import type { NeedsAdvancedInput } from '@features/orders/hooks/payment-needs-advanced';

const baseSimple: NeedsAdvancedInput = {
  settlementLegCount: 1,
  hasCustomerCreditApplied: false,
  isB2BCreditInvoice: false,
  hasGiftCardOrPromo: false,
  overpaymentNeedsResolution: false,
  pinRequired: false,
  cashDrawerSessionChoiceCount: 1,
  cashDrawerBlocked: false,
  showCurrencyRounding: false,
};

describe('computeNeedsAdvanced', () => {
  it('stays Simple for a single exact-cash / single-card leg', () => {
    const result = computeNeedsAdvanced(baseSimple);
    expect(result.needsAdvanced).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('stays Simple with zero legs (nothing selected yet)', () => {
    const result = computeNeedsAdvanced({ ...baseSimple, settlementLegCount: 0 });
    expect(result.needsAdvanced).toBe(false);
  });

  it.each<[keyof NeedsAdvancedInput, NeedsAdvancedInput[keyof NeedsAdvancedInput], string]>([
    ['settlementLegCount', 2, NEEDS_ADVANCED_REASON.SPLIT_PAYMENT],
    ['hasCustomerCreditApplied', true, NEEDS_ADVANCED_REASON.CUSTOMER_CREDIT],
    ['isB2BCreditInvoice', true, NEEDS_ADVANCED_REASON.B2B_CREDIT_INVOICE],
    ['hasGiftCardOrPromo', true, NEEDS_ADVANCED_REASON.GIFT_CARD_OR_PROMO],
    ['overpaymentNeedsResolution', true, NEEDS_ADVANCED_REASON.OVERPAYMENT_ROUTING],
    ['pinRequired', true, NEEDS_ADVANCED_REASON.GIFT_CARD_PIN],
    ['cashDrawerSessionChoiceCount', 2, NEEDS_ADVANCED_REASON.DRAWER_AMBIGUOUS],
    ['cashDrawerBlocked', true, NEEDS_ADVANCED_REASON.DRAWER_BLOCKED],
    ['showCurrencyRounding', true, NEEDS_ADVANCED_REASON.CURRENCY_ROUNDING],
  ])('escalates to Full when %s triggers', (field, value, expectedReason) => {
    const result = computeNeedsAdvanced({ ...baseSimple, [field]: value } as NeedsAdvancedInput);
    expect(result.needsAdvanced).toBe(true);
    expect(result.reasons).toContain(expectedReason);
  });

  it('does not escalate on a single open drawer session', () => {
    expect(
      computeNeedsAdvanced({ ...baseSimple, cashDrawerSessionChoiceCount: 1 }).needsAdvanced
    ).toBe(false);
  });

  it('returns priority-ordered reasons when several conditions hold', () => {
    const result = computeNeedsAdvanced({
      ...baseSimple,
      settlementLegCount: 3,
      hasGiftCardOrPromo: true,
      pinRequired: true,
    });
    expect(result.reasons).toEqual([
      NEEDS_ADVANCED_REASON.SPLIT_PAYMENT,
      NEEDS_ADVANCED_REASON.GIFT_CARD_OR_PROMO,
      NEEDS_ADVANCED_REASON.GIFT_CARD_PIN,
    ]);
  });
});
