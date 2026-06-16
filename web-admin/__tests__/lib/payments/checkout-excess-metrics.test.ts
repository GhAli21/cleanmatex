import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { computeCheckoutExcessMetrics } from '@/lib/payments/checkout-excess-metrics';

describe('computeCheckoutExcessMetrics', () => {
  const saleTotal = 100;

  it('intent OFF auto-resolves applied excess via cash change capacity', () => {
    const metrics = computeCheckoutExcessMetrics({
      saleTotal,
      immediateSettlementAmount: 105,
      legs: [
        {
          paymentMethodCode: PAYMENT_METHODS.CASH,
          amount: 105,
          tenderedAmount: 110,
          supportsChangeReturn: true,
        },
      ],
      payExtraIntent: false,
    });

    expect(metrics.appliedExcessAmount).toBe(5);
    expect(metrics.changeResolvedAmount).toBe(5);
    expect(metrics.unresolvedExcessAmount).toBe(0);
  });

  it('intent ON includes tender surplus in unresolved excess', () => {
    const metrics = computeCheckoutExcessMetrics({
      saleTotal,
      immediateSettlementAmount: 110,
      legs: [
        {
          paymentMethodCode: PAYMENT_METHODS.CASH,
          amount: 110,
          tenderedAmount: 120,
          supportsChangeReturn: true,
        },
      ],
      payExtraIntent: true,
    });

    expect(metrics.appliedExcessAmount).toBe(10);
    expect(metrics.tenderSurplusAmount).toBe(10);
    expect(metrics.unresolvedExcessAmount).toBe(20);
  });

  it('intent ON reduces unresolved when RETURN_CASH_CHANGE is explicit', () => {
    const metrics = computeCheckoutExcessMetrics({
      saleTotal,
      immediateSettlementAmount: 110,
      legs: [
        {
          paymentMethodCode: PAYMENT_METHODS.CASH,
          amount: 110,
          tenderedAmount: 120,
          supportsChangeReturn: true,
        },
      ],
      payExtraIntent: true,
      explicitChangeResolved: 20,
    });

    expect(metrics.unresolvedExcessAmount).toBe(0);
  });

  it('pools multi-leg applied excess', () => {
    const metrics = computeCheckoutExcessMetrics({
      saleTotal,
      immediateSettlementAmount: 115,
      legs: [
        {
          paymentMethodCode: PAYMENT_METHODS.CARD,
          amount: 60,
          supportsChangeReturn: false,
        },
        {
          paymentMethodCode: PAYMENT_METHODS.CASH,
          amount: 55,
          tenderedAmount: 55,
          supportsChangeReturn: true,
        },
      ],
      payExtraIntent: false,
    });

    expect(metrics.appliedExcessAmount).toBe(15);
    expect(metrics.unresolvedExcessAmount).toBe(15);
  });
});
