import {
  deriveRequiredActionCopy,
  derivePaymentModalRightRailState,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
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
    creditLimitValue: 0,
    creditLimitAvailable: 0,
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
  it('provides a specific account-billing action for a credit-limit blocker', () => {
    const copy = deriveRequiredActionCopy({
      t: (key) => key,
      requiredAction: RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT,
      overpaymentBlocksSubmit: false,
      payExtraIntent: false,
      validationPhase: 'ready',
      currencyCode: 'OMR',
      formatAmount: (value) => value.toFixed(3),
      unresolvedOverpaymentAmount: 0,
      cashDrawerBlockingMessage: null,
      liveWalletBalanceDisplay: 'OMR 0.000',
    });

    expect(copy?.actionLabel).toBe(
      'rightRail.requiredAction.reviewAccountBilling'
    );
    expect(copy?.message).toBe('rightRail.requiredAction.creditLimitBlock');
  });

  it('derives blocked status when blocking issues exist', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({ hasBlockingIssues: true, remainingBalance: 10 })
    );

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.BLOCKED);
  });

  it('prioritizes overpaid status above fully settled', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({ changeAmount: 5, remainingBalance: 0, canReturnChangeFromCash: false })
    );

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.OVERPAID);
  });

  it('treats cash-backed change as fully settled instead of overpaid', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        changeAmount: 0.5,
        remainingBalance: 0,
        canReturnChangeFromCash: true,
      })
    );

    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED);
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

  it('surfaces the credit-limit action when the receivable exceeds available credit', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: true,
        creditLimitValue: 100,
        creditLimitAvailable: 40,
        remainingBalance: 70,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );

    expect(state.requiredAction).toBe(RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT);
  });

  it('does not surface the credit-limit action once the receivable fits available credit (pay-to-fit)', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: false,
        creditLimitValue: 100,
        creditLimitAvailable: 40,
        remainingBalance: 40,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );

    expect(state.requiredAction).toBeNull();
  });

  it('does not surface credit-limit action when fully settled (cash/card)', () => {
    const state = derivePaymentModalRightRailState(
      makeInput({
        hasBlockingIssues: false,
        creditLimitValue: 100,
        creditLimitAvailable: 0,
        remainingBalance: 0,
        effectiveOutstandingPolicy: 'NONE',
      })
    );

    expect(state.requiredAction).toBeNull();
    expect(state.balanceStatus).toBe(RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED);
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

});
