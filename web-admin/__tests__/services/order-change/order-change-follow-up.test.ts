import { planOrderChangeFollowUp, resolutionAmountWithinCap } from '@/lib/services/order-change/order-change-follow-up';

const base = {
  paymentTypeCode: 'PAY_ON_COLLECTION',
  outstandingAmount: '0.0000',
  overpaidAmount: '0.0000',
  currencyCode: 'OMR',
  hasCustomer: true,
};

describe('planOrderChangeFollowUp', () => {
  it('sends a pay-on-collection balance to the existing collection route', () => {
    const plan = planOrderChangeFollowUp({ ...base, outstandingAmount: '12.5000' });
    expect(plan.actions).toEqual([expect.objectContaining({
      code: 'COLLECT_PAY_ON_COLLECTION',
      path: '/api/v1/orders/[id]/payments',
      permission: 'orders:collect_payment',
      amountCap: '12.5000',
      executesHere: false,
    })]);
    expect(plan.unavailable).toEqual([]);
  });

  it('does not collect or change any other original payment type', () => {
    const plan = planOrderChangeFollowUp({ ...base, paymentTypeCode: 'FULL_PAYMENT', outstandingAmount: '4.0000' });
    expect(plan.actions).toEqual([]);
    expect(plan.unavailable).toEqual([{
      code: 'COLLECT_PAY_ON_COLLECTION',
      reason: 'COLLECTION_UNSUPPORTED_FOR_PAYMENT_TYPE',
    }]);
  });

  it('offers stored value for an overpayment and keeps refunds unavailable', () => {
    const plan = planOrderChangeFollowUp({ ...base, overpaidAmount: '3.0000' });
    expect(plan.actions.map((action) => action.code)).toEqual([
      'SAVE_AS_CUSTOMER_ADVANCE',
      'SAVE_AS_CUSTOMER_CREDIT',
      'SAVE_TO_CUSTOMER_WALLET',
    ]);
    expect(plan.actions.every((action) => action.executesHere && action.path === '/api/v1/orders/[id]/financial-resolution')).toBe(true);
    expect(plan.unavailable.map((item) => item.reason)).toEqual([
      'REFUND_LIFECYCLE_SEPARATE',
      'GATEWAY_REFUND_NOT_AUTOMATIC',
    ]);
  });

  it('does not offer stored value without a customer', () => {
    const plan = planOrderChangeFollowUp({ ...base, hasCustomer: false, overpaidAmount: '3.0000' });
    expect(plan.actions).toEqual([]);
    expect(plan.unavailable.map((item) => item.reason)).toContain('CUSTOMER_REQUIRED');
  });

  it('rejects an amount above the unresolved overpayment', () => {
    expect(resolutionAmountWithinCap('3.0000', '3.0000')).toBe(true);
    expect(resolutionAmountWithinCap('3.0000', '3.0100')).toBe(false);
    expect(resolutionAmountWithinCap('3.0000', '0')).toBe(false);
  });
});
