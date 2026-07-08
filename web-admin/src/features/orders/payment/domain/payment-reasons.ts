/**
 * Unified payment reason codes (explainability layer of the composable payment
 * system). Every shown / hidden / required / blocked / suggested state in the
 * payment UI carries one of these codes — never a hardcoded string — so the UI,
 * QA, and support can always answer "why is this shown / blocked / suggested".
 *
 * Two families:
 *
 * 1. **Server-mirror codes** — values are the EXACT backend error codes thrown
 *    by the submit route/orchestrator (DB-mirror rule for cross-boundary
 *    strings). A UI guard that mirrors a server rule names the same cause the
 *    server would reject with, so guidance and enforcement can never diverge.
 * 2. **UX affordance codes** (`SHOWN_*`, `REQUIRED_*`, `SUGGEST_*`) — pure UI
 *    states with no server analogue.
 *
 * Message keys resolve codes to EN/AR text under
 * `newOrder.payment.reasons.<code>` (catalog entries added with the consuming
 * UI). See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import {
  NEEDS_ADVANCED_REASON,
  type NeedsAdvancedReason,
} from '@features/orders/hooks/payment-needs-advanced';

/**
 * Stable reason codes for payment capability states and guards.
 */
export const PAYMENT_REASON = {
  // ---- server-mirror (values MUST equal backend error codes) ----
  B2B_CREDIT_HOLD: 'B2B_CREDIT_HOLD',
  B2B_CREDIT_EXCEEDED: 'B2B_CREDIT_EXCEEDED',
  SPLIT_AMOUNT_MISMATCH: 'SPLIT_AMOUNT_MISMATCH',
  DEFERRED_LEG_NOT_ALONE: 'DEFERRED_LEG_NOT_ALONE',
  OUTSTANDING_POLICY_REQUIRED: 'OUTSTANDING_POLICY_REQUIRED',
  CASH_DRAWER_SESSION_REQUIRED: 'CASH_DRAWER_SESSION_REQUIRED',
  CASH_DRAWER_SESSION_SELECTION_REQUIRED: 'CASH_DRAWER_SESSION_SELECTION_REQUIRED',
  CASH_DRAWER_SESSION_CLOSED: 'CASH_DRAWER_SESSION_CLOSED',
  OVERPAYMENT_RESOLUTION_REQUIRED: 'OVERPAYMENT_RESOLUTION_REQUIRED',
  PAYMENT_REFERENCE_REQUIRED: 'PAYMENT_REFERENCE_REQUIRED',
  PAYMENT_TERMINAL_REQUIRED: 'PAYMENT_TERMINAL_REQUIRED',
  CHECK_NUMBER_REQUIRED: 'CHECK_NUMBER_REQUIRED',

  // ---- UX affordances (no server analogue) ----
  SHOWN_SPLIT_ACTIVE: 'SHOWN_SPLIT_ACTIVE',
  SHOWN_GIFT_CARD_DETECTED: 'SHOWN_GIFT_CARD_DETECTED',
  SHOWN_PROMO_DETECTED: 'SHOWN_PROMO_DETECTED',
  SHOWN_CUSTOMER_CREDIT_AVAILABLE: 'SHOWN_CUSTOMER_CREDIT_AVAILABLE',
  SHOWN_FX_ROUNDING_ACTIVE: 'SHOWN_FX_ROUNDING_ACTIVE',
  REQUIRED_GIFT_CARD_PIN: 'REQUIRED_GIFT_CARD_PIN',
  REQUIRED_B2B_FIELDS_MISSING: 'REQUIRED_B2B_FIELDS_MISSING',
  SUGGEST_FULL_COMPLEXITY: 'SUGGEST_FULL_COMPLEXITY',
} as const;

/**
 * Union of all payment reason codes.
 */
export type PaymentReasonCode =
  (typeof PAYMENT_REASON)[keyof typeof PAYMENT_REASON];

/**
 * Maps backend submit error codes to the reason code the UI renders as an
 * in-view guard. Codes not in this map fall back to the generic error path —
 * never to a forced view switch. Extended in Phase 5 (server-error →
 * capability-guard routing).
 */
export const SERVER_ERROR_TO_REASON: Record<string, PaymentReasonCode> = {
  B2B_CREDIT_HOLD: PAYMENT_REASON.B2B_CREDIT_HOLD,
  B2B_CREDIT_EXCEEDED: PAYMENT_REASON.B2B_CREDIT_EXCEEDED,
  SPLIT_AMOUNT_MISMATCH: PAYMENT_REASON.SPLIT_AMOUNT_MISMATCH,
  DEFERRED_LEG_NOT_ALONE: PAYMENT_REASON.DEFERRED_LEG_NOT_ALONE,
  OUTSTANDING_POLICY_REQUIRED: PAYMENT_REASON.OUTSTANDING_POLICY_REQUIRED,
  CASH_DRAWER_SESSION_REQUIRED: PAYMENT_REASON.CASH_DRAWER_SESSION_REQUIRED,
  CASH_DRAWER_SESSION_SELECTION_REQUIRED:
    PAYMENT_REASON.CASH_DRAWER_SESSION_SELECTION_REQUIRED,
  CASH_DRAWER_SESSION_CLOSED: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
  OVERPAYMENT_RESOLUTION_REQUIRED: PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED,
  PAYMENT_REFERENCE_REQUIRED: PAYMENT_REASON.PAYMENT_REFERENCE_REQUIRED,
  PAYMENT_TERMINAL_REQUIRED: PAYMENT_REASON.PAYMENT_TERMINAL_REQUIRED,
  CHECK_NUMBER_REQUIRED: PAYMENT_REASON.CHECK_NUMBER_REQUIRED,
};

/**
 * Maps the retained `computeNeedsAdvanced` reasons (the demoted suggestion's
 * inputs) into the unified reason space. All complexity reasons collapse to one
 * suggestion code; the specific `NeedsAdvancedReason` list is still surfaced in
 * the suggestion copy for detail.
 */
export function needsAdvancedToSuggestion(
  reasons: NeedsAdvancedReason[],
): PaymentReasonCode | null {
  return reasons.length > 0 ? PAYMENT_REASON.SUGGEST_FULL_COMPLEXITY : null;
}

/**
 * i18n key for a reason code (namespace `newOrder`), e.g.
 * `payment.reasons.B2B_CREDIT_EXCEEDED`.
 */
export function reasonMessageKey(code: PaymentReasonCode): string {
  return `payment.reasons.${code}`;
}

// Re-export so capability code has one import site for both reason spaces.
export { NEEDS_ADVANCED_REASON };
export type { NeedsAdvancedReason };
