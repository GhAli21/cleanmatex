import {
  derivePaymentModalRightRailState,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
  RIGHT_RAIL_WARNING,
  type PaymentModalRightRailInput,
} from '@features/orders/ui/payment-modal-v4.right-rail';

function makeInput(
  overrides: Partial<PaymentModalRightRailInput> = {}
): PaymentModalRightRailInput {
  return {
    hasBlockingIssues: false,
    changeAmount: 0,
    remainingBalance: 0,
    effectiveOutstandingPolicy: 'NONE',
    epsilon: 0.0001,
    cashDrawerBlockingMessage: null,
    creditLimitWouldExceed: false,
    creditLimitMode: 'block',
    creditLimitOverride: false,
    pinRequired: false,
    hasCheckLegWithoutNumber: false,
    walletLegExceedsLiveBalance: false,
    invalidImmediateAmount: false,
    canReturnChangeFromCash: false,
    currencyExRate: 1,
    roundingAmount: 0,
    ...overrides,
  };
}

describe('payment-modal-v4 right rail', () => {
  it('derives blocked status when blocking issues exist', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({ hasBlockingIssues: true, remainingBalance: 10 })
    );

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.BLOCKED);
  });

  it('prioritizes overpaid status above fully settled', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({ changeAmount: 5, remainingBalance: 0 })
    );

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.OVERPAID);
  });

  it('derives fully settled status when remaining balance is cleared', () => {
    const state = derivePaymentModalRightRailState(makeInput());

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED);
  });

  it('derives pay on collection status for deferred retail balance', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        remainingBalance: 15,
        effectiveOutstandingPolicy: 'PAY_ON_COLLECTION',
      })
    );

    expect(state.balanceStatus).toBe(
      RIGHT_RAIL_BALANCE_STATUS.PAY_ON_COLLECTION
    );
  });

  it('derives invoice outstanding status for deferred B2B balance', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        remainingBalance: 15,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );

    expect(state.balanceStatus).toBe(
      RIGHT_RAIL_BALANCE_STATUS.INVOICE_OUTSTANDING
    );
  });

  it('uses overpayment as the highest-priority required action', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        changeAmount: 2,
        cashDrawerBlockingMessage: 'Drawer required',
      })
    );

    expect(state.requiredAction).toBe(RIGHT_RAIL_REQUIRED_ACTION.OVERPAYMENT);
  });

  it('does not treat cash-backed change as an overpayment required action', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        changeAmount: 2,
        canReturnChangeFromCash: true,
        hasCheckLegWithoutNumber: true,
      })
    );

    expect(state.requiredAction).toBe(RIGHT_RAIL_REQUIRED_ACTION.CHECK_DETAILS);
  });

  it('surfaces a cash drawer blocker before other validation items', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        cashDrawerBlockingMessage: 'Drawer required',
        invalidImmediateAmount: true,
      })
    );

    expect(state.requiredAction).toBe(RIGHT_RAIL_REQUIRED_ACTION.CASH_DRAWER);
  });

  it('requires credit-limit confirmation when warn mode has no override', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        creditLimitWouldExceed: true,
        creditLimitMode: 'warn',
        creditLimitOverride: false,
      })
    );

    expect(state.requiredAction).toBe(RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT);
  });

  it('surfaces gift card pin requirement before remaining-policy fallback', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        pinRequired: true,
        remainingBalance: 12,
        effectiveOutstandingPolicy: 'NONE',
      })
    );

    expect(state.requiredAction).toBe(
      RIGHT_RAIL_REQUIRED_ACTION.GIFT_CARD_PIN
    );
  });

  it('shows remaining-policy action when balance remains without a policy', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        remainingBalance: 12,
        effectiveOutstandingPolicy: 'NONE',
      })
    );

    expect(state.requiredAction).toBe(
      RIGHT_RAIL_REQUIRED_ACTION.REMAINING_POLICY
    );
  });

  it('hides balance policy once the order is fully settled', () => {
    const state = derivePaymentModalRightRailState(makeInput());

    expect(state.showBalancePolicy).toBe(false);
  });

  it('hides balance policy when the payment is overpaid', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        changeAmount: 1,
        remainingBalance: 5,
      })
    );

    expect(state.showBalancePolicy).toBe(false);
  });

  it('shows currency and rounding only for non-default exchange data', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        currencyExRate: 3.75,
      })
    );

    expect(state.showCurrencyRounding).toBe(true);
  });

  it('emits a non-blocking warning when credit-limit override is enabled', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        creditLimitWouldExceed: true,
        creditLimitMode: 'warn',
        creditLimitOverride: true,
      })
    );

    expect(state.warningCodes).toEqual([
      RIGHT_RAIL_WARNING.CREDIT_LIMIT_OVERRIDE,
    ]);
  });
});
