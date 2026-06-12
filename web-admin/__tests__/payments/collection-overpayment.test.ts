/**
 * Tests: collection-overpayment metrics (later collection parity)
 */

import { computeCollectionOverpaymentMetrics } from '@/lib/payments/collection-overpayment';

describe('computeCollectionOverpaymentMetrics', () => {
  it('returns zero unresolved excess when cash change covers over-collection', () => {
    const metrics = computeCollectionOverpaymentMetrics(50, [
      {
        legIndex: 0,
        orgPaymentMethodId: 'pm-cash',
        paymentMethodCode: 'CASH',
        amount: 50,
        cashTendered: 51,
        supportsChangeReturn: true,
        supportsOverpayment: false,
        requiresCashDrawer: true,
      },
    ]);

    expect(metrics.excessAmount).toBe(0);
    expect(metrics.unresolvedExcessAmount).toBe(0);
    expect(metrics.cashChangeCapacity).toBe(1);
  });

  it('flags unresolved excess for non-cash over-collection without retention', () => {
    const metrics = computeCollectionOverpaymentMetrics(50, [
      {
        legIndex: 0,
        orgPaymentMethodId: 'pm-card',
        paymentMethodCode: 'CARD',
        amount: 55,
        supportsChangeReturn: false,
        supportsOverpayment: false,
        requiresCashDrawer: false,
      },
    ]);

    expect(metrics.excessAmount).toBe(5);
    expect(metrics.unresolvedExcessAmount).toBe(5);
    expect(metrics.hasAllowedRetainedOverpayment).toBe(false);
  });

  it('requires disposition for non-cash over-collection even when method allows retention', () => {
    const metrics = computeCollectionOverpaymentMetrics(50, [
      {
        legIndex: 0,
        orgPaymentMethodId: 'pm-card',
        paymentMethodCode: 'CARD',
        amount: 55,
        supportsChangeReturn: false,
        supportsOverpayment: true,
        requiresCashDrawer: false,
      },
    ]);

    expect(metrics.excessAmount).toBe(5);
    expect(metrics.unresolvedExcessAmount).toBe(5);
  });
});
