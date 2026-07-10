import {
  capCollectPaymentAmount,
  isPaymentLegDetailLocked,
  resolvePaymentOverpaymentPolicy,
  resolveSupportsRetainedOverpayment,
} from '@/lib/payments/overpayment-policy';

describe('resolveSupportsRetainedOverpayment', () => {
  const cardPolicy = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CARD',
    supportsOverpayment: true,
    supportsChangeReturn: false,
  });

  const cashChangePolicy = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CASH',
    supportsOverpayment: false,
    supportsChangeReturn: true,
  });

  const cardNoOverpay = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CARD',
    supportsOverpayment: false,
  });

  it('returns false when payExtraIntent is OFF even if method supports overpayment', () => {
    expect(
      resolveSupportsRetainedOverpayment({
        payExtraIntent: false,
        policy: cardPolicy,
      })
    ).toBe(false);
  });

  it('returns true for non-cash when intent ON and method supports overpayment', () => {
    expect(
      resolveSupportsRetainedOverpayment({
        payExtraIntent: true,
        policy: cardPolicy,
      })
    ).toBe(true);
  });

  it('returns false for non-cash when intent ON but method does not support overpayment', () => {
    expect(
      resolveSupportsRetainedOverpayment({
        payExtraIntent: true,
        policy: cardNoOverpay,
      })
    ).toBe(false);
  });

  it('returns true for cash+change when intent ON (retained cash overpay path)', () => {
    expect(
      resolveSupportsRetainedOverpayment({
        payExtraIntent: true,
        policy: cashChangePolicy,
      })
    ).toBe(true);
  });

  it('returns false for cash+change when intent OFF (change uses tendered path, not retained)', () => {
    expect(
      resolveSupportsRetainedOverpayment({
        payExtraIntent: false,
        policy: cashChangePolicy,
      })
    ).toBe(false);
  });
});

describe('capCollectPaymentAmount', () => {
  it('caps non-cash above outstanding when payExtraIntent is OFF', () => {
    expect(
      capCollectPaymentAmount({
        rawAmount: 10,
        outstandingAmount: 7.897,
        payExtraIntent: false,
        paymentMethodCode: 'CARD',
        supportsOverpayment: true,
        decimalPlaces: 3,
      })
    ).toBe(7.897);
  });

  it('allows non-cash above outstanding when payExtraIntent is ON', () => {
    expect(
      capCollectPaymentAmount({
        rawAmount: 10,
        outstandingAmount: 7.897,
        payExtraIntent: true,
        paymentMethodCode: 'CARD',
        supportsOverpayment: true,
        decimalPlaces: 3,
      })
    ).toBe(10);
  });
});

describe('isPaymentLegDetailLocked', () => {
  it('locks details when fully settled, amount is zero, and pay-extra is OFF', () => {
    expect(
      isPaymentLegDetailLocked({
        legAmount: 0,
        remainingBalance: 0,
        payExtraIntent: false,
        moneyEpsilon: 0.001,
      })
    ).toBe(true);
  });

  it('keeps details editable on unpaid orders even at zero amount', () => {
    expect(
      isPaymentLegDetailLocked({
        legAmount: 0,
        remainingBalance: 3.05,
        payExtraIntent: false,
        moneyEpsilon: 0.001,
      })
    ).toBe(false);
  });

  it('keeps details editable when pay-extra is ON even at zero amount', () => {
    expect(
      isPaymentLegDetailLocked({
        legAmount: 0,
        remainingBalance: 0,
        payExtraIntent: true,
        moneyEpsilon: 0.001,
      })
    ).toBe(false);
  });

  it('keeps details editable when leg has applied amount', () => {
    expect(
      isPaymentLegDetailLocked({
        legAmount: 3.05,
        remainingBalance: 0,
        payExtraIntent: false,
        moneyEpsilon: 0.001,
      })
    ).toBe(false);
  });
});
