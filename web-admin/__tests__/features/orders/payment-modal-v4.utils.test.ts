import {
  applyKeypadInput,
  deriveOutstandingPolicy,
  getSuggestedStoredValueAmount,
  getWalletLegMaxAmount,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  walletLegExceedsBalance,
} from '@features/orders/ui/payment-modal-v4.utils';

describe('payment-modal-v4 utils', () => {
  it('sanitizes decimal drafts to one decimal separator', () => {
    expect(sanitizeDecimalDraft('1..23', 3)).toBe('1.23');
  });

  it('applies keypad digits and decimal safely', () => {
    let draft = '';
    draft = applyKeypadInput(draft, '1', 3);
    draft = applyKeypadInput(draft, '2', 3);
    draft = applyKeypadInput(draft, '.', 3);
    draft = applyKeypadInput(draft, '5', 3);
    expect(draft).toBe('12.5');
  });

  it('supports decimal-first keypad entry after clearing a leg', () => {
    let draft = '';
    draft = applyKeypadInput(draft, '.', 3);
    draft = applyKeypadInput(draft, '5', 3);
    expect(draft).toBe('0.5');
  });

  it('supports quick-add keypad shortcuts', () => {
    const draft = applyKeypadInput('1.5', '+10', 3);
    expect(draft).toBe('11.5');
  });

  it('derives no outstanding policy for full payment', () => {
    expect(deriveOutstandingPolicy(100, 100, 'CREDIT_INVOICE')).toBe('NONE');
  });

  it('keeps preferred outstanding policy for partial payment', () => {
    expect(deriveOutstandingPolicy(40, 100, 'CREDIT_INVOICE')).toBe('CREDIT_INVOICE');
  });

  it('syncs manual discount from percent', () => {
    expect(syncDiscountFromPercent(100, 5, 3)).toBe(5);
  });

  it('syncs manual discount percent from amount', () => {
    expect(syncDiscountPercentFromAmount(200, 10)).toBe(5);
  });

  it('suggests a wallet leg amount capped by live balance and remaining due', () => {
    expect(getSuggestedStoredValueAmount(40, 20, 100, 3)).toBe(40);
    expect(getSuggestedStoredValueAmount(80, 40, 100, 3)).toBe(60);
  });

  it('caps wallet editing to the remaining order allocation for that leg', () => {
    const paymentLegs = [{ amount: 60 }, { amount: 40 }];
    expect(getWalletLegMaxAmount(50, paymentLegs, 1, 100, 3)).toBe(40);
    expect(getWalletLegMaxAmount(50, paymentLegs, 0, 100, 3)).toBe(50);
  });

  it('detects when a live wallet refresh makes the applied leg invalid', () => {
    expect(walletLegExceedsBalance(40, 20)).toBe(true);
    expect(walletLegExceedsBalance(40, 40)).toBe(false);
  });
});
