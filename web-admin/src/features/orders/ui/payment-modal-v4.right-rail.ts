import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';

/**
 * Stable semantic states for the payment modal right-rail headline card.
 *
 * The right rail should describe the checkout outcome in cashier language
 * without re-implementing submit-time finance logic inside JSX conditionals.
 */
export const RIGHT_RAIL_BALANCE_STATUS = {
  BLOCKED: 'BLOCKED',
  OVERPAID: 'OVERPAID',
  FULLY_SETTLED: 'FULLY_SETTLED',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  INVOICE_OUTSTANDING: 'INVOICE_OUTSTANDING',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
} as const;

export type RightRailBalanceStatus =
  (typeof RIGHT_RAIL_BALANCE_STATUS)[keyof typeof RIGHT_RAIL_BALANCE_STATUS];

/**
 * Priority-ordered reasons that should surface in the prominent action card.
 *
 * Keeping these values explicit makes the UI testable and prevents the action
 * surface from silently drifting away from the existing submit validation flow.
 */
export const RIGHT_RAIL_REQUIRED_ACTION = {
  OVERPAYMENT: 'OVERPAYMENT',
  CASH_DRAWER: 'CASH_DRAWER',
  CREDIT_LIMIT: 'CREDIT_LIMIT',
  GIFT_CARD_PIN: 'GIFT_CARD_PIN',
  CHECK_DETAILS: 'CHECK_DETAILS',
  STORED_VALUE: 'STORED_VALUE',
  PAYMENT_AMOUNT: 'PAYMENT_AMOUNT',
  REMAINING_POLICY: 'REMAINING_POLICY',
  GENERIC: 'GENERIC',
} as const;

export type RightRailRequiredActionKind =
  (typeof RIGHT_RAIL_REQUIRED_ACTION)[keyof typeof RIGHT_RAIL_REQUIRED_ACTION];

/**
 * Non-blocking warning codes that can be rendered separately from blockers.
 *
 * The modal already owns strict validation; this warning list exists only for
 * cashier-facing heads-up states that should not disable submission.
 */
export const RIGHT_RAIL_WARNING = {
  CREDIT_LIMIT_OVERRIDE: 'CREDIT_LIMIT_OVERRIDE',
} as const;

export type RightRailWarningCode =
  (typeof RIGHT_RAIL_WARNING)[keyof typeof RIGHT_RAIL_WARNING];

/**
 * Inputs required to derive the cashier-facing right-rail state.
 */
export interface PaymentModalRightRailInput {
  hasBlockingIssues: boolean;
  changeAmount: number;
  remainingBalance: number;
  effectiveOutstandingPolicy: OutstandingPolicy;
  epsilon: number;
  cashDrawerBlockingMessage: string | null;
  creditLimitWouldExceed: boolean;
  creditLimitMode?: 'warn' | 'block';
  creditLimitOverride: boolean;
  pinRequired: boolean;
  hasCheckLegWithoutNumber: boolean;
  walletLegExceedsLiveBalance: boolean;
  invalidImmediateAmount: boolean;
  canReturnChangeFromCash: boolean;
  currencyExRate?: number | null;
  roundingAmount?: number | null;
}

/**
 * Derived state used by the redesigned right rail.
 */
export interface PaymentModalRightRailState {
  balanceStatus: RightRailBalanceStatus;
  requiredAction: RightRailRequiredActionKind | null;
  showBalancePolicy: boolean;
  showCurrencyRounding: boolean;
  warningCodes: RightRailWarningCode[];
}

/**
 * Maps existing trusted modal state into a stable right-rail view model.
 *
 * @example
 * derivePaymentModalRightRailState({
 *   hasBlockingIssues: false,
 *   changeAmount: 0,
 *   remainingBalance: 12.5,
 *   effectiveOutstandingPolicy: 'PAY_ON_COLLECTION',
 *   epsilon: 0.0001,
 *   cashDrawerBlockingMessage: null,
 *   creditLimitWouldExceed: false,
 *   creditLimitOverride: false,
 *   pinRequired: false,
 *   hasCheckLegWithoutNumber: false,
 *   walletLegExceedsLiveBalance: false,
 *   invalidImmediateAmount: false,
 *   currencyExRate: 1,
 *   roundingAmount: 0,
 * })
 * @returns A cashier-safe summary of status, action priority, and conditional card visibility.
 */
export function derivePaymentModalRightRailState(
  input: PaymentModalRightRailInput
): PaymentModalRightRailState {
  const balanceStatus = deriveBalanceStatus(input);
  const requiredAction = deriveRequiredAction(input);
  const showBalancePolicy =
    input.remainingBalance > input.epsilon &&
    input.changeAmount <= input.epsilon;
  const exchangeRate = input.currencyExRate ?? 1;
  const roundingAmount = input.roundingAmount ?? 0;
  const showCurrencyRounding =
    Math.abs(exchangeRate - 1) > input.epsilon ||
    Math.abs(roundingAmount) > input.epsilon;
  const warningCodes: RightRailWarningCode[] = [];

  if (
    input.creditLimitWouldExceed &&
    input.creditLimitMode === 'warn' &&
    input.creditLimitOverride
  ) {
    warningCodes.push(RIGHT_RAIL_WARNING.CREDIT_LIMIT_OVERRIDE);
  }

  return {
    balanceStatus,
    requiredAction,
    showBalancePolicy,
    showCurrencyRounding,
    warningCodes,
  };
}

function deriveBalanceStatus(
  input: PaymentModalRightRailInput
): RightRailBalanceStatus {
  if (input.hasBlockingIssues) {
    return RIGHT_RAIL_BALANCE_STATUS.BLOCKED;
  }

  if (input.changeAmount > input.epsilon) {
    return RIGHT_RAIL_BALANCE_STATUS.OVERPAID;
  }

  if (input.remainingBalance <= input.epsilon) {
    return RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED;
  }

  if (input.effectiveOutstandingPolicy === 'PAY_ON_COLLECTION') {
    return RIGHT_RAIL_BALANCE_STATUS.PAY_ON_COLLECTION;
  }

  if (input.effectiveOutstandingPolicy === 'CREDIT_INVOICE') {
    return RIGHT_RAIL_BALANCE_STATUS.INVOICE_OUTSTANDING;
  }

  return RIGHT_RAIL_BALANCE_STATUS.PAYMENT_REQUIRED;
}

function deriveRequiredAction(
  input: PaymentModalRightRailInput
): RightRailRequiredActionKind | null {
  if (!input.hasBlockingIssues) {
    return null;
  }

  if (input.changeAmount > input.epsilon && !input.canReturnChangeFromCash) {
    return RIGHT_RAIL_REQUIRED_ACTION.OVERPAYMENT;
  }

  if (input.cashDrawerBlockingMessage) {
    return RIGHT_RAIL_REQUIRED_ACTION.CASH_DRAWER;
  }

  if (
    input.creditLimitWouldExceed &&
    (input.creditLimitMode === 'block' ||
      (input.creditLimitMode === 'warn' && !input.creditLimitOverride))
  ) {
    return RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT;
  }

  if (input.pinRequired) {
    return RIGHT_RAIL_REQUIRED_ACTION.GIFT_CARD_PIN;
  }

  if (input.hasCheckLegWithoutNumber) {
    return RIGHT_RAIL_REQUIRED_ACTION.CHECK_DETAILS;
  }

  if (input.walletLegExceedsLiveBalance) {
    return RIGHT_RAIL_REQUIRED_ACTION.STORED_VALUE;
  }

  if (input.invalidImmediateAmount) {
    return RIGHT_RAIL_REQUIRED_ACTION.PAYMENT_AMOUNT;
  }

  if (
    input.remainingBalance > input.epsilon &&
    input.effectiveOutstandingPolicy === 'NONE'
  ) {
    return RIGHT_RAIL_REQUIRED_ACTION.REMAINING_POLICY;
  }

  return RIGHT_RAIL_REQUIRED_ACTION.GENERIC;
}
