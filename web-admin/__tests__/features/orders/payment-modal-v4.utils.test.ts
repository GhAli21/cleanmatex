import {
  applyKeypadInput,
  deriveOutstandingPolicy,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
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
});
