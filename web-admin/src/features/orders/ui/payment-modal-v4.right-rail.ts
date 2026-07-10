import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';
import { isB2BCreditLimitBlocking } from './payment-modal-v4.utils';

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

/**
 * Union of cashier-facing balance statuses derived from trusted modal totals.
 */
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

/**
 * Union of required-action reasons shown in the prominent action surface.
 */
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

/**
 * Union of non-blocking warning codes supported by the right rail.
 */
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
 * @param input Already-derived payment modal state used only for view mapping.
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
    isB2BCreditLimitBlocking({
      wouldExceed: input.creditLimitWouldExceed,
      remainingBalance: input.remainingBalance,
      outstandingPolicy: input.effectiveOutstandingPolicy,
      epsilon: input.epsilon,
    }) &&
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

  if (input.changeAmount > input.epsilon && !input.canReturnChangeFromCash) {
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
    isB2BCreditLimitBlocking({
      wouldExceed: input.creditLimitWouldExceed,
      remainingBalance: input.remainingBalance,
      outstandingPolicy: input.effectiveOutstandingPolicy,
      epsilon: input.epsilon,
    }) &&
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

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type RightRailTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * Maps a balance status to its cashier-facing label.
 *
 * @param balanceStatus Derived right-rail balance status.
 * @param t Translate function.
 * @returns Localized status label.
 */
export function deriveBalanceStatusLabel(
  balanceStatus: RightRailBalanceStatus,
  t: RightRailTranslate
): string {
  switch (balanceStatus) {
    case RIGHT_RAIL_BALANCE_STATUS.BLOCKED:
      return t('rightRail.statuses.blocked');
    case RIGHT_RAIL_BALANCE_STATUS.OVERPAID:
      return t('rightRail.statuses.overpaid');
    case RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED:
      return t('rightRail.statuses.fullySettled');
    case RIGHT_RAIL_BALANCE_STATUS.PAY_ON_COLLECTION:
      return t('rightRail.statuses.payOnCollection');
    case RIGHT_RAIL_BALANCE_STATUS.INVOICE_OUTSTANDING:
      return t('rightRail.statuses.invoiceOutstanding');
    default:
      return t('rightRail.statuses.paymentRequired');
  }
}

/**
 * Title/message pair shown in the prominent required-action surface.
 */
export interface RequiredActionCopy {
  title: string;
  message: string;
  /** Optional action copy when the blocker owns a specific corrective surface. */
  actionLabel?: string;
}

/**
 * Inputs for the required-action copy builder — all already-derived modal state.
 */
export interface RequiredActionCopyContext {
  t: RightRailTranslate;
  requiredAction: RightRailRequiredActionKind | null;
  overpaymentBlocksSubmit: boolean;
  payExtraIntent: boolean;
  validationPhase: 'editing' | 'ready';
  currencyCode: string;
  formatAmount: (value: number) => string;
  unresolvedOverpaymentAmount: number;
  cashDrawerBlockingMessage: string | null;
  creditLimitMode?: 'warn' | 'block';
  liveWalletBalanceDisplay: string;
  /** `validationItems[0]` — used as the GENERIC fallback message. */
  firstValidationItem?: string;
}

/**
 * Builds the title/message for the prominent required-action card.
 *
 * @param ctx Already-derived modal state + translate/format helpers.
 * @returns Title/message copy, or null when no action surface is needed.
 */
export function deriveRequiredActionCopy(
  ctx: RequiredActionCopyContext
): RequiredActionCopy | null {
  const { t } = ctx;
  if (ctx.overpaymentBlocksSubmit && ctx.payExtraIntent && ctx.validationPhase !== 'ready') {
    return {
      title: t('validatePayment.button'),
      message: t('validatePayment.requiredBeforeSubmit'),
    };
  }

  switch (ctx.requiredAction) {
    case RIGHT_RAIL_REQUIRED_ACTION.OVERPAYMENT:
      return {
        title: t('rightRail.requiredAction.overpaymentTitle'),
        message: t('rightRail.requiredAction.overpaymentMessage', {
          amount: `${ctx.currencyCode} ${ctx.formatAmount(ctx.unresolvedOverpaymentAmount)}`,
        }),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.CASH_DRAWER:
      return {
        title: t('rightRail.requiredAction.cashDrawerTitle'),
        message: ctx.cashDrawerBlockingMessage ?? t('rightRail.requiredAction.cashDrawerFallback'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT:
      return {
        title: t('rightRail.requiredAction.creditLimitTitle'),
        message:
          ctx.creditLimitMode === 'warn'
            ? t('rightRail.requiredAction.creditLimitWarn')
            : t('rightRail.requiredAction.creditLimitBlock'),
        actionLabel: t('rightRail.requiredAction.reviewAccountBilling'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.GIFT_CARD_PIN:
      return {
        title: t('rightRail.requiredAction.giftCardPinTitle'),
        message: t('giftCard.pinPendingError'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.CHECK_DETAILS:
      return {
        title: t('rightRail.requiredAction.checkTitle'),
        message: t('splitPayment.validation.checkNumberRequired'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.STORED_VALUE:
      return {
        title: t('rightRail.requiredAction.storedValueTitle'),
        message: t('customerCredits.walletBalanceExceeded', {
          amount: ctx.liveWalletBalanceDisplay,
        }),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.PAYMENT_AMOUNT:
      return {
        title: t('rightRail.requiredAction.paymentAmountTitle'),
        message: t('partialPayment.validation.amountMustBePositive'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.REMAINING_POLICY:
      return {
        title: t('rightRail.requiredAction.remainingPolicyTitle'),
        message: t('remainder.validation.required'),
      };
    case RIGHT_RAIL_REQUIRED_ACTION.GENERIC:
      return {
        title: t('rightRail.requiredAction.genericTitle'),
        message: ctx.firstValidationItem ?? t('messages.validationErrors'),
      };
    default:
      return null;
  }
}

/**
 * Maps non-blocking warning codes to cashier-facing messages.
 *
 * @param warningCodes Derived non-blocking warning codes.
 * @param t Translate function.
 * @returns Localized warning messages.
 */
export function deriveRightRailWarningMessages(
  warningCodes: RightRailWarningCode[],
  t: RightRailTranslate
): string[] {
  const warnings: string[] = [];
  warningCodes.forEach((warningCode) => {
    if (warningCode === RIGHT_RAIL_WARNING.CREDIT_LIMIT_OVERRIDE) {
      warnings.push(t('rightRail.warningMessages.creditLimitOverride'));
    }
  });
  return warnings;
}
