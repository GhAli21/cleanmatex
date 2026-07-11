import {
  deriveBalanceStatusLabel,
  deriveRequiredActionCopy,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
} from '@features/orders/ui/payment-modal-v4.right-rail';
import type { RequiredActionCopyContext } from '@features/orders/ui/payment-modal-v4.right-rail';

const t = (key: string) => key;

function copyCtx(
  overrides: Partial<RequiredActionCopyContext> = {}
): RequiredActionCopyContext {
  return {
    t,
    requiredAction: null,
    overpaymentBlocksSubmit: false,
    payExtraIntent: false,
    validationPhase: 'editing',
    currencyCode: 'OMR',
    formatAmount: (n) => n.toFixed(3),
    unresolvedOverpaymentAmount: 0,
    cashDrawerBlockingMessage: null,
    liveWalletBalanceDisplay: 'OMR 0.000',
    firstValidationItem: undefined,
    ...overrides,
  };
}

describe('deriveBalanceStatusLabel', () => {
  it.each([
    [RIGHT_RAIL_BALANCE_STATUS.BLOCKED, 'rightRail.statuses.blocked'],
    [RIGHT_RAIL_BALANCE_STATUS.OVERPAID, 'rightRail.statuses.overpaid'],
    [RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED, 'rightRail.statuses.fullySettled'],
    [RIGHT_RAIL_BALANCE_STATUS.PAY_ON_COLLECTION, 'rightRail.statuses.payOnCollection'],
    [RIGHT_RAIL_BALANCE_STATUS.INVOICE_OUTSTANDING, 'rightRail.statuses.invoiceOutstanding'],
    [RIGHT_RAIL_BALANCE_STATUS.PAYMENT_REQUIRED, 'rightRail.statuses.paymentRequired'],
  ])('maps %s to its label', (status, expected) => {
    expect(deriveBalanceStatusLabel(status, t)).toBe(expected);
  });
});

describe('deriveRequiredActionCopy', () => {
  it('returns null when there is no required action', () => {
    expect(deriveRequiredActionCopy(copyCtx())).toBeNull();
  });

  it('prioritizes the validate-first message in the pay-extra flow', () => {
    const copy = deriveRequiredActionCopy(
      copyCtx({
        overpaymentBlocksSubmit: true,
        payExtraIntent: true,
        validationPhase: 'editing',
        requiredAction: RIGHT_RAIL_REQUIRED_ACTION.OVERPAYMENT,
      })
    );
    expect(copy).toEqual({
      title: 'validatePayment.button',
      message: 'validatePayment.requiredBeforeSubmit',
    });
  });

  it('maps cash-drawer action to the live blocking message when present', () => {
    const copy = deriveRequiredActionCopy(
      copyCtx({
        requiredAction: RIGHT_RAIL_REQUIRED_ACTION.CASH_DRAWER,
        cashDrawerBlockingMessage: 'No open session',
      })
    );
    expect(copy?.message).toBe('No open session');
  });

  it('uses the actionable block copy for the credit-limit action (no override)', () => {
    const copy = deriveRequiredActionCopy(
      copyCtx({ requiredAction: RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT })
    );
    expect(copy?.message).toBe('rightRail.requiredAction.creditLimitBlock');
    expect(copy?.actionLabel).toBe('rightRail.requiredAction.reviewAccountBilling');
  });

  it('falls back to the first validation item for GENERIC, else a default key', () => {
    expect(
      deriveRequiredActionCopy(
        copyCtx({ requiredAction: RIGHT_RAIL_REQUIRED_ACTION.GENERIC, firstValidationItem: 'Fix X' })
      )?.message
    ).toBe('Fix X');
    expect(
      deriveRequiredActionCopy(copyCtx({ requiredAction: RIGHT_RAIL_REQUIRED_ACTION.GENERIC }))?.message
    ).toBe('messages.validationErrors');
  });
});

