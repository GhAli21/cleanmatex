import { evaluateB2BFulfilmentPaymentHold } from '@/lib/services/workflow/b2b-fulfilment-payment-hold.service';

describe('B2B fulfilment payment-hold seam', () => {
  it('does not stop a credit-invoice fulfilment until the B2B domain owns its policy', () => {
    expect(evaluateB2BFulfilmentPaymentHold({ paymentTypeCode: 'CREDIT_INVOICE' })).toEqual({
      isBlocked: false,
    });
  });
});
