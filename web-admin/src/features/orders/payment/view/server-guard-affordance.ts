/**
 * Server-guard affordance resolution (Phase 5 — server-error → capability
 * routing, container half).
 *
 * `routeServerErrorToGuard` (domain) answers *which capability* owns a server
 * rejection; this module answers *what the guard's corrective action does* in
 * the container — open that capability's in-place dialog, open the Advanced
 * workbench, or nothing (message-only, when the fields to fix are already in
 * view). Pure and exhaustive over {@link PaymentCapabilityKey} so adding a
 * capability without deciding its guard affordance is a type error.
 *
 * The container maps each affordance token to its concrete handler (dialog
 * open-state setter / mode switch); no React or engine coupling here.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { PaymentCapabilityKey } from '../capabilities/capability-keys';

/**
 * What the server-guard's corrective action button does in the container.
 */
export const SERVER_GUARD_AFFORDANCE = {
  /** Open the split-tender dialog. */
  SPLIT_DIALOG: 'SPLIT_DIALOG',
  /** Open the gift-card dialog. */
  GIFT_DIALOG: 'GIFT_DIALOG',
  /** Open the promo-code dialog. */
  PROMO_DIALOG: 'PROMO_DIALOG',
  /** Open the customer-credit (store credit) dialog. */
  CREDIT_DIALOG: 'CREDIT_DIALOG',
  /** Open the pay-later (balance policy) dialog. */
  PAY_LATER_DIALOG: 'PAY_LATER_DIALOG',
  /** Open the cash-drawer session dialog. */
  CASH_DRAWER_DIALOG: 'CASH_DRAWER_DIALOG',
  /** Open the overpayment (extra receipt) dialog. */
  OVERPAYMENT_DIALOG: 'OVERPAYMENT_DIALOG',
  /** Switch to the Advanced (Full) workbench — no in-place dialog yet. */
  ADVANCED_VIEW: 'ADVANCED_VIEW',
  /** Message-only guard — the fields to fix are already in view. */
  NONE: 'NONE',
} as const;

/**
 * Union of server-guard affordance tokens.
 */
export type ServerGuardAffordance =
  (typeof SERVER_GUARD_AFFORDANCE)[keyof typeof SERVER_GUARD_AFFORDANCE];

/**
 * Corrective affordance per capability. Exhaustive by construction: the
 * `Record` over {@link PaymentCapabilityKey} forces a decision for every key.
 * CASH / CARD / FX_ROUNDING are never routed by `routeServerErrorToGuard`
 * (no server error code maps to them) — pinned to NONE for totality.
 * SUBMIT_GUARDS aggregates per-leg tender-detail rules (reference / terminal /
 * check number) whose inputs are already rendered in place — message-only.
 */
const CAPABILITY_GUARD_AFFORDANCE: Record<
  PaymentCapabilityKey,
  ServerGuardAffordance
> = {
  CASH: SERVER_GUARD_AFFORDANCE.NONE,
  CARD: SERVER_GUARD_AFFORDANCE.NONE,
  CASH_CARD_SPLIT: SERVER_GUARD_AFFORDANCE.SPLIT_DIALOG,
  SPLIT_TENDER: SERVER_GUARD_AFFORDANCE.SPLIT_DIALOG,
  GIFT_CARD: SERVER_GUARD_AFFORDANCE.GIFT_DIALOG,
  PROMO_CODE: SERVER_GUARD_AFFORDANCE.PROMO_DIALOG,
  CUSTOMER_CREDIT: SERVER_GUARD_AFFORDANCE.CREDIT_DIALOG,
  PAY_LATER: SERVER_GUARD_AFFORDANCE.PAY_LATER_DIALOG,
  B2B_ACCOUNT_BILLING: SERVER_GUARD_AFFORDANCE.ADVANCED_VIEW,
  CASH_DRAWER: SERVER_GUARD_AFFORDANCE.CASH_DRAWER_DIALOG,
  OVERPAYMENT_ROUTING: SERVER_GUARD_AFFORDANCE.OVERPAYMENT_DIALOG,
  FX_ROUNDING: SERVER_GUARD_AFFORDANCE.NONE,
  SUBMIT_GUARDS: SERVER_GUARD_AFFORDANCE.NONE,
};

/**
 * Resolves the corrective affordance for a server-guard's owning capability.
 *
 * @param capability - The capability that owns the server rejection.
 * @returns The affordance token the container maps to a concrete handler.
 */
export function resolveServerGuardAffordance(
  capability: PaymentCapabilityKey,
): ServerGuardAffordance {
  return CAPABILITY_GUARD_AFFORDANCE[capability];
}
