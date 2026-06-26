/**
 * Pure escalation predicate for Payment Modal v4 (Simple → Full).
 *
 * The modal opens in Simple mode and auto-escalates to Full when complexity is
 * detected. This module is the single, testable source of that decision so the
 * mode switch, the "why did it escalate" banner, and the manual-Simple lock all
 * agree. It is intentionally pure (no React, no state) — callers thread already
 * derived modal flags in. See
 * `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`.
 */

/**
 * Stable reason codes for why the modal must run in Full (advanced) mode.
 * Order is priority order — the first reason is the most salient for the banner.
 */
export const NEEDS_ADVANCED_REASON = {
  SPLIT_PAYMENT: 'SPLIT_PAYMENT',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  B2B_CREDIT_INVOICE: 'B2B_CREDIT_INVOICE',
  GIFT_CARD_OR_PROMO: 'GIFT_CARD_OR_PROMO',
  OVERPAYMENT_ROUTING: 'OVERPAYMENT_ROUTING',
  GIFT_CARD_PIN: 'GIFT_CARD_PIN',
  DRAWER_AMBIGUOUS: 'DRAWER_AMBIGUOUS',
  DRAWER_BLOCKED: 'DRAWER_BLOCKED',
  CURRENCY_ROUNDING: 'CURRENCY_ROUNDING',
} as const;

/**
 * Union of advanced-mode escalation reasons.
 */
export type NeedsAdvancedReason =
  (typeof NEEDS_ADVANCED_REASON)[keyof typeof NEEDS_ADVANCED_REASON];

/**
 * Already-derived modal flags used only to decide Simple vs Full. Every field is
 * a trusted value the modal already computes elsewhere — this function never
 * recomputes money or validation.
 */
export interface NeedsAdvancedInput {
  /** Count of settlement legs with a positive amount. >1 means a split. */
  settlementLegCount: number;
  /** True when a customer advance / stored-credit leg is being applied. */
  hasCustomerCreditApplied: boolean;
  /** True for B2B credit-invoice / AR policy (B2B customer or CREDIT_INVOICE). */
  isB2BCreditInvoice: boolean;
  /** True when a gift card or promo code is applied. */
  hasGiftCardOrPromo: boolean;
  /** True when an overpayment still needs routing (allocation/advance/etc.). */
  overpaymentNeedsResolution: boolean;
  /** True when a gift-card PIN is required and not yet satisfied. */
  pinRequired: boolean;
  /** Number of open cash-drawer sessions the cashier may choose from. */
  cashDrawerSessionChoiceCount: number;
  /** True when a cash-drawer blocking message is present. */
  cashDrawerBlocked: boolean;
  /** True when FX (rate ≠ 1) or non-zero rounding is active. */
  showCurrencyRounding: boolean;
}

/**
 * Result of the escalation check.
 */
export interface NeedsAdvancedResult {
  needsAdvanced: boolean;
  /** Priority-ordered reasons; empty when the order can stay in Simple mode. */
  reasons: NeedsAdvancedReason[];
}

/**
 * Decides whether the payment modal must run in Full (advanced) mode.
 *
 * Exact-cash or a single card swipe with none of the advanced conditions stays
 * in Simple mode. Any single condition forces Full and is surfaced as a reason.
 *
 * @param input Already-derived modal flags.
 * @returns Whether Full mode is required and the priority-ordered reasons.
 */
export function computeNeedsAdvanced(input: NeedsAdvancedInput): NeedsAdvancedResult {
  const reasons: NeedsAdvancedReason[] = [];

  if (input.settlementLegCount > 1) {
    reasons.push(NEEDS_ADVANCED_REASON.SPLIT_PAYMENT);
  }
  if (input.hasCustomerCreditApplied) {
    reasons.push(NEEDS_ADVANCED_REASON.CUSTOMER_CREDIT);
  }
  if (input.isB2BCreditInvoice) {
    reasons.push(NEEDS_ADVANCED_REASON.B2B_CREDIT_INVOICE);
  }
  if (input.hasGiftCardOrPromo) {
    reasons.push(NEEDS_ADVANCED_REASON.GIFT_CARD_OR_PROMO);
  }
  if (input.overpaymentNeedsResolution) {
    reasons.push(NEEDS_ADVANCED_REASON.OVERPAYMENT_ROUTING);
  }
  if (input.pinRequired) {
    reasons.push(NEEDS_ADVANCED_REASON.GIFT_CARD_PIN);
  }
  if (input.cashDrawerSessionChoiceCount > 1) {
    reasons.push(NEEDS_ADVANCED_REASON.DRAWER_AMBIGUOUS);
  }
  if (input.cashDrawerBlocked) {
    reasons.push(NEEDS_ADVANCED_REASON.DRAWER_BLOCKED);
  }
  if (input.showCurrencyRounding) {
    reasons.push(NEEDS_ADVANCED_REASON.CURRENCY_ROUNDING);
  }

  return { needsAdvanced: reasons.length > 0, reasons };
}
