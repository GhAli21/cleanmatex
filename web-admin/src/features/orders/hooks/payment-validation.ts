/**
 * Pure submit-gate logic for Payment Modal v4.
 *
 * `derivePaymentValidationItems` is a verbatim extraction of the modal's
 * `validationItems` memo — the single list of human-readable reasons that block
 * submission. Pulling it out of the component makes the "can we submit?" rules
 * unit-testable and shareable with Collect Payment, without changing behavior.
 *
 * It stays pure: the caller threads already-derived flags + a translate function
 * in, and the component keeps the surrounding `useMemo` (React semantics unchanged).
 * Behavior freeze: must stay byte-equivalent to the original inline logic.
 */

import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import {
  isB2BCreditLimitBlocking,
  validateCheckDueDate,
} from '@features/orders/ui/payment-modal-v4.utils';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentValidationTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * A settlement leg paired with its index (matches `useMoneyDerivations`).
 */
export interface ValidationLegEntry {
  leg: PaymentLeg;
}

/**
 * Stored-value exceedance descriptor for the offending leg.
 */
export interface ValidationStoredValueExceedance {
  leg: PaymentLeg;
  cap: number;
}

/**
 * Already-derived modal flags consumed by the submit-gate rules. Functions
 * (`t`, `getMethodOption`, `getOptionDisplayName`) and primitives are threaded in;
 * nothing is recomputed here.
 *
 * @typeParam TOption Settlement-option shape returned by `getMethodOption`.
 */
export interface PaymentValidationItemsContext<TOption> {
  t: PaymentValidationTranslate;
  currencyCode: string;
  formatAmount: (value: number) => string;
  getMethodOption: (method: string, gatewayCode?: string | null) => TOption | undefined;
  getOptionDisplayName: (option: TOption | undefined, fallbackMethodCode?: string) => string;

  promoCodeValidating: boolean;
  giftCardValidating: boolean;

  overpaymentBlocksSubmit: boolean;
  payExtraIntent: boolean;
  validationPhase: 'editing' | 'ready';
  unresolvedOverpaymentAmount: number;

  checkNumberError?: string | null;
  amountDiscountError?: string | null;
  percentDiscountError?: string | null;

  pinRequired: boolean;
  hasCheckLegWithoutNumber: boolean;
  hasCheckLegWithInvalidDate: boolean;
  paymentLegs: PaymentLeg[];
  legsMissingRequiredReference: PaymentLeg[];

  walletLegExceedsLiveBalance: boolean;
  liveWalletBalanceDisplay: string;
  storedValueLegExceedsBalance: boolean;
  storedValueLegExceedance: ValidationStoredValueExceedance | null;

  creditNoteLegsMissingReference: ValidationLegEntry[];
  terminalRequiredLegs: ValidationLegEntry[];

  cashDrawerBlockingMessage: string | null;
  invalidImmediateAmount: boolean;
  remainingBalance: number;
  effectiveOutstandingPolicy: OutstandingPolicy;

  creditLimitValue: number;
  creditLimitAvailable: number;
}

/**
 * Builds the deduped, ordered list of reasons that block payment submission.
 *
 * @param ctx Already-derived modal flags + translate/display helpers.
 * @returns Unique, order-preserving list of blocking messages (empty = submittable).
 */
export function derivePaymentValidationItems<TOption>(
  ctx: PaymentValidationItemsContext<TOption>
): string[] {
  const { t } = ctx;
  const items: string[] = [];

  if (ctx.promoCodeValidating) {
    items.push(t('promoCode.validating'));
  }
  if (ctx.giftCardValidating) {
    items.push(t('giftCard.checking'));
  }
  if (ctx.overpaymentBlocksSubmit) {
    if (ctx.payExtraIntent && ctx.validationPhase !== 'ready') {
      items.push(t('validatePayment.requiredBeforeSubmit'));
    } else {
      items.push(
        t('rightRail.requiredAction.overpaymentMessage', {
          amount: `${ctx.currencyCode} ${ctx.formatAmount(ctx.unresolvedOverpaymentAmount)}`,
        })
      );
    }
  }
  if (ctx.checkNumberError) {
    items.push(String(ctx.checkNumberError));
  }
  if (ctx.amountDiscountError) {
    items.push(String(ctx.amountDiscountError));
  }
  if (ctx.percentDiscountError) {
    items.push(String(ctx.percentDiscountError));
  }
  if (ctx.pinRequired) {
    items.push(t('giftCard.pinPendingError'));
  }
  if (ctx.hasCheckLegWithoutNumber) {
    items.push(t('splitPayment.validation.checkNumberRequired'));
  }
  if (ctx.hasCheckLegWithInvalidDate) {
    const invalidLeg = ctx.paymentLegs.find(
      (leg) =>
        leg.method === PAYMENT_METHODS.CHECK &&
        (leg.amount ?? 0) > 0 &&
        validateCheckDueDate(leg.checkDate)
    );
    if (invalidLeg) {
      items.push(t(`splitPayment.${validateCheckDueDate(invalidLeg.checkDate)!}`));
    }
  }
  ctx.legsMissingRequiredReference.forEach((leg) => {
    items.push(
      t('splitPayment.validation.referenceRequired', {
        method: ctx.getOptionDisplayName(ctx.getMethodOption(leg.method, leg.gateway_code), leg.method),
      })
    );
  });
  if (ctx.walletLegExceedsLiveBalance) {
    items.push(
      t('customerCredits.walletBalanceExceeded', {
        amount: ctx.liveWalletBalanceDisplay,
      })
    );
  }
  if (
    ctx.storedValueLegExceedsBalance &&
    ctx.storedValueLegExceedance &&
    !ctx.walletLegExceedsLiveBalance
  ) {
    items.push(
      t('customerCredits.storedValueBalanceExceeded', {
        method: ctx.getOptionDisplayName(
          ctx.getMethodOption(
            ctx.storedValueLegExceedance.leg.method,
            ctx.storedValueLegExceedance.leg.gateway_code
          ),
          ctx.storedValueLegExceedance.leg.method
        ),
        amount: `${ctx.currencyCode} ${ctx.formatAmount(ctx.storedValueLegExceedance.cap)}`,
      })
    );
  }
  ctx.creditNoteLegsMissingReference.forEach(() => {
    items.push(t('customerCredits.creditNoteRequired'));
  });
  ctx.terminalRequiredLegs.forEach(({ leg }) => {
    items.push(
      t('splitPayment.validation.terminalRequired', {
        method: ctx.getOptionDisplayName(ctx.getMethodOption(leg.method, leg.gateway_code), leg.method),
      })
    );
  });
  if (ctx.cashDrawerBlockingMessage) {
    items.push(ctx.cashDrawerBlockingMessage);
  }
  if (ctx.invalidImmediateAmount) {
    items.push(t('partialPayment.validation.amountMustBePositive'));
  }
  if (ctx.remainingBalance > 0.001 && ctx.effectiveOutstandingPolicy === 'NONE') {
    items.push(t('remainder.validation.required'));
  }
  if (
    isB2BCreditLimitBlocking({
      creditLimit: ctx.creditLimitValue,
      available: ctx.creditLimitAvailable,
      remainingBalance: ctx.remainingBalance,
      outstandingPolicy: ctx.effectiveOutstandingPolicy,
    })
  ) {
    // Credit-limit exceedance is always blocked (no cashier override — pay the
    // balance or raise the limit in customer settings). Mirrors the server-side
    // hard-deny; the `warn` mode no longer softens it client-side.
    items.push(t('b2b.creditExceeded'));
  }

  return [...new Set(items)];
}
