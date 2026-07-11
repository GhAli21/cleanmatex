import {
  capCollectPaymentAmount,
  isPaymentLegDetailLocked,
  resolveNewPaymentLegRejection,
  resolvePaymentAmountCapReason,
  resolvePaymentLegDetailLockReason,
  resolvePaymentOverpaymentPolicy,
  resolveSupportsRetainedOverpayment,
} from '@/lib/payments/overpayment-policy';

describe('resolveSupportsRetainedOverpayment', () => {
  const cardPolicy = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CARD',
    supportsOverpayment: true,
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
        rawAmount: 20,
        outstandingAmount: 10,
        payExtraIntent: false,
        paymentMethodCode: 'CARD',
        supportsOverpayment: true,
      })
    ).toBe(10);
  });

  it('allows non-cash above outstanding when payExtraIntent is ON', () => {
    expect(
      capCollectPaymentAmount({
        rawAmount: 20,
        outstandingAmount: 10,
        payExtraIntent: true,
        paymentMethodCode: 'CARD',
        supportsOverpayment: true,
      })
    ).toBe(20);
  });
});

describe('resolvePaymentAmountCapReason', () => {
  const checkNoOverpay = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CHECK',
    supportsOverpayment: false,
  });
  const cashNoChange = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CASH',
    supportsChangeReturn: false,
    supportsOverpayment: false,
  });
  const cardOverpay = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CARD',
    supportsOverpayment: true,
  });

  it('returns pay_extra_off when intent is OFF', () => {
    expect(
      resolvePaymentAmountCapReason({
        wasCapped: true,
        payExtraIntent: false,
        policy: checkNoOverpay,
      })
    ).toBe('pay_extra_off');
  });

  it('returns method_no_overpayment when intent is ON but method cannot overpay', () => {
    expect(
      resolvePaymentAmountCapReason({
        wasCapped: true,
        payExtraIntent: true,
        policy: checkNoOverpay,
      })
    ).toBe('method_no_overpayment');
  });

  it('returns cash_no_change for cash without change return', () => {
    expect(
      resolvePaymentAmountCapReason({
        wasCapped: true,
        payExtraIntent: false,
        policy: cashNoChange,
      })
    ).toBe('cash_no_change');
  });

  it('returns null when retained overpayment is allowed', () => {
    expect(
      resolvePaymentAmountCapReason({
        wasCapped: true,
        payExtraIntent: true,
        policy: cardOverpay,
      })
    ).toBeNull();
  });

  it('returns null when not capped', () => {
    expect(
      resolvePaymentAmountCapReason({
        wasCapped: false,
        payExtraIntent: false,
        policy: checkNoOverpay,
      })
    ).toBeNull();
  });
});

describe('resolveNewPaymentLegRejection', () => {
  const checkNoOverpay = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CHECK',
    supportsOverpayment: false,
  });
  const cardOverpay = resolvePaymentOverpaymentPolicy({
    paymentMethodCode: 'CARD',
    supportsOverpayment: true,
  });

  it('allows a new leg when remaining balance is positive', () => {
    expect(
      resolveNewPaymentLegRejection({
        remainingBalance: 3.05,
        payExtraIntent: false,
        policy: checkNoOverpay,
        moneyEpsilon: 0.001,
      })
    ).toBeNull();
  });

  it('rejects when remaining is zero and pay-extra is OFF', () => {
    expect(
      resolveNewPaymentLegRejection({
        remainingBalance: 0,
        payExtraIntent: false,
        policy: checkNoOverpay,
        moneyEpsilon: 0.001,
      })
    ).toBe('pay_extra_off');
  });

  it('rejects when remaining is zero, pay-extra ON, but method cannot overpay', () => {
    expect(
      resolveNewPaymentLegRejection({
        remainingBalance: 0,
        payExtraIntent: true,
        policy: checkNoOverpay,
        moneyEpsilon: 0.001,
      })
    ).toBe('method_no_overpayment');
  });

  it('allows when remaining is zero and method can retain overpayment', () => {
    expect(
      resolveNewPaymentLegRejection({
        remainingBalance: 0,
        payExtraIntent: true,
        policy: cardOverpay,
        moneyEpsilon: 0.001,
      })
    ).toBeNull();
  });
});

describe('isPaymentLegDetailLocked (deprecated — always unlocked for existing legs)', () => {
  it('never locks existing legs (cashier decision)', () => {
    expect(
      isPaymentLegDetailLocked({
        legAmount: 0,
        remainingBalance: 0,
        supportsRetainedOverpayment: false,
        moneyEpsilon: 0.001,
      })
    ).toBe(false);
  });
});

describe('resolvePaymentLegDetailLockReason', () => {
  it('returns null when not locked', () => {
    expect(
      resolvePaymentLegDetailLockReason({ locked: false, payExtraIntent: true })
    ).toBeNull();
  });
});
