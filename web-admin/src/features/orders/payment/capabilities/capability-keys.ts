/**
 * Payment capability keys (L3 of the composable payment system).
 *
 * A "capability" is one payment feature the cashier can use — cash, card, a
 * split, a gift card, etc. Views (presets) compose capabilities; they never
 * hardcode feature logic. This file is intentionally tiny: it declares only the
 * stable keys. The declarative rules (available/required/blocked/presentation)
 * live in the capability registry added in Phase 1, and each capability's UI
 * lives under `payment/capabilities/{key}/`.
 *
 * These keys are UI-domain identifiers (not DB values), so the DB-mirror rule
 * does not apply. See
 * `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`.
 */

/**
 * Stable capability identifiers for the payment system.
 */
export const PAYMENT_CAPABILITY = {
  CASH: 'CASH',
  CARD: 'CARD',
  CASH_CARD_SPLIT: 'CASH_CARD_SPLIT',
  SPLIT_TENDER: 'SPLIT_TENDER',
  GIFT_CARD: 'GIFT_CARD',
  PROMO_CODE: 'PROMO_CODE',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  PAY_LATER: 'PAY_LATER',
  B2B_ACCOUNT_BILLING: 'B2B_ACCOUNT_BILLING',
  CASH_DRAWER: 'CASH_DRAWER',
  OVERPAYMENT_ROUTING: 'OVERPAYMENT_ROUTING',
  FX_ROUNDING: 'FX_ROUNDING',
  SUBMIT_GUARDS: 'SUBMIT_GUARDS',
} as const;

/**
 * Union of all payment capability keys.
 */
export type PaymentCapabilityKey =
  (typeof PAYMENT_CAPABILITY)[keyof typeof PAYMENT_CAPABILITY];

/**
 * All capability keys as an array (stable order), for iteration in the registry
 * and tests.
 */
export const PAYMENT_CAPABILITY_KEYS = Object.values(
  PAYMENT_CAPABILITY,
) as PaymentCapabilityKey[];
