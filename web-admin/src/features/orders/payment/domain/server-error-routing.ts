/**
 * Server-error → capability-guard routing (hardening #2; Phase-5 groundwork).
 *
 * When the submit route/orchestrator rejects with a typed error code, the UI must
 * render an **in-view guard on the relevant capability** — the cashier is never
 * ejected to another view, and server truth and UI guidance name the same cause
 * (the reason code is the exact backend code, per the server-mirror rule). This
 * module maps each backend error code to `{ capability, reason }`:
 *
 * - `reason` comes from {@link SERVER_ERROR_TO_REASON} (server-mirror identity).
 * - `capability` is the surface that owns the guard; codes with a reason but no
 *   dedicated owner (reference/terminal/check-number) route to the aggregate
 *   `SUBMIT_GUARDS` surface.
 * - an **unknown** code returns `null` → the caller falls back to its existing
 *   generic error path, **never** a forced view switch.
 *
 * Pure — no React, no money math, no container coupling. Phase 5 wires the
 * container's `infrastructureMessages` flow (`use-order-submission.ts:607-646`)
 * through this.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import {
  PAYMENT_CAPABILITY,
  type PaymentCapabilityKey,
} from '../capabilities/capability-keys';
import {
  SERVER_ERROR_TO_REASON,
  type PaymentReasonCode,
} from './payment-reasons';

/**
 * The capability whose guard region should surface a given backend error code.
 * Codes present in {@link SERVER_ERROR_TO_REASON} but absent here have no
 * dedicated owner and fall back to the aggregate `SUBMIT_GUARDS` surface.
 */
const SERVER_ERROR_TO_CAPABILITY: Record<string, PaymentCapabilityKey> = {
  B2B_CREDIT_HOLD: PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
  B2B_CREDIT_EXCEEDED: PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
  SPLIT_AMOUNT_MISMATCH: PAYMENT_CAPABILITY.SPLIT_TENDER,
  DEFERRED_LEG_NOT_ALONE: PAYMENT_CAPABILITY.PAY_LATER,
  OUTSTANDING_POLICY_REQUIRED: PAYMENT_CAPABILITY.PAY_LATER,
  CASH_DRAWER_SESSION_REQUIRED: PAYMENT_CAPABILITY.CASH_DRAWER,
  CASH_DRAWER_SESSION_SELECTION_REQUIRED: PAYMENT_CAPABILITY.CASH_DRAWER,
  CASH_DRAWER_SESSION_CLOSED: PAYMENT_CAPABILITY.CASH_DRAWER,
  OVERPAYMENT_RESOLUTION_REQUIRED: PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
  // PAYMENT_REFERENCE_REQUIRED / PAYMENT_TERMINAL_REQUIRED / CHECK_NUMBER_REQUIRED
  // are per-leg tender-detail rules with no dedicated capability → they route to
  // the aggregate SUBMIT_GUARDS surface via the fallback below.
};

/**
 * Where a server rejection surfaces in the UI: the capability guard + the
 * server-mirror reason code.
 */
export interface ServerErrorGuardRoute {
  capability: PaymentCapabilityKey;
  reason: PaymentReasonCode;
}

/**
 * Routes a backend submit error code to the in-view capability guard, or `null`
 * for an unknown code (caller uses its generic error path — never a view switch).
 *
 * @param errorCode - The backend error code from the submit rejection.
 * @returns The guard route, or `null` when the code is unknown.
 */
export function routeServerErrorToGuard(
  errorCode: string,
): ServerErrorGuardRoute | null {
  const reason = SERVER_ERROR_TO_REASON[errorCode];
  if (!reason) return null;
  const capability =
    SERVER_ERROR_TO_CAPABILITY[errorCode] ?? PAYMENT_CAPABILITY.SUBMIT_GUARDS;
  return { capability, reason };
}
