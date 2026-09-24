/**
 * Cash-drawer effective-cash facts (B16).
 *
 * Why this module exists:
 * Drawer close, session summary, and the drawer reports historically summed
 * EVERY payment linked to a session (`cash_drawer_session_id`) into expected
 * cash — with no `payment_status`, no `is_active`, and no method filter
 * (audit finding M2 / §50-B16, `cash-drawer.service.ts:1428`). A pending
 * cheque leg, a gateway `PENDING`/`AUTHORIZED` leg, a soft-deleted row, or a
 * non-cash (card) leg that happened to carry the session id therefore inflated
 * the drawer's expected physical cash and produced a wrong variance.
 *
 * The physical cash a drawer should hold from order payments is exactly the
 * sum of payments that are (1) active, (2) in the frozen COMPLETED lifecycle
 * set (D001 / D005 — the same set used by the order-financial aggregation, so
 * there is ONE definition of "financially successful"), and (3) a cash-family
 * method (only cash physically enters the drawer). This module owns that
 * predicate as both a Prisma `where` fragment (DB-side aggregation) and a pure
 * in-memory predicate (display-time reduction), so every consumer applies the
 * identical rule.
 *
 * Applied unconditionally across the drawer-close, session-summary, and
 * list/detail expected-cash paths (B16 M2 fix — no feature flag).
 *
 * Pure and server-safe (no `PrismaClient`/query import): callers build their
 * own query or pass their own rows. It does use Prisma's standalone
 * `Decimal` runtime type (via `lib/utils/money`) for drift-free summation —
 * that carries no DB connection and is safe in the same pure/testable sense.
 */

import type { Decimal } from '@prisma/client/runtime/library';
import { CASH_DRAWER_MOVEMENT_TYPES, PAYMENT_METHODS } from '@/lib/constants/payment';
import { ORDER_PAYMENT_LIFECYCLE_STATUSES } from '@/lib/constants/order-financial';
import { isCompletedPaymentStatus } from '@/lib/services/order-financial-aggregation';
import { sumMoney, type MoneyInput } from '@/lib/utils/money';

/**
 * Cash-family payment method codes — the only methods whose settled amount is
 * physical cash in a drawer. A single-member family today (`CASH`); kept as a
 * list so a future cash-equivalent code (e.g. a petty-cash tender) can join
 * without touching every call site. Mirrors the DB `payment_method_code`
 * values exactly (DB-mirror rule).
 */
export const CASH_PAYMENT_METHOD_CODES: readonly string[] = [PAYMENT_METHODS.CASH];

/**
 * Frozen COMPLETED lifecycle set (COMPLETED / CAPTURED / SETTLED) reused from
 * the canonical constants — never redefined here (D001 / D005 invariant).
 */
export const EFFECTIVE_CASH_PAYMENT_STATUSES: readonly string[] =
  ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED;

const CASH_METHOD_SET = new Set(CASH_PAYMENT_METHOD_CODES.map((c) => c.toUpperCase()));

/**
 * Prisma `where` fragment selecting effective cash payments. Spread into an
 * `org_order_payments_dtl` query alongside the tenant + session filters:
 *
 * ```ts
 * where: { tenant_org_id, cash_drawer_session_id: sessionId, ...effectiveCashPaymentWhere() }
 * ```
 */
export function effectiveCashPaymentWhere(): {
  is_active: true;
  payment_status: { in: string[] };
  payment_method_code: { in: string[] };
} {
  return {
    is_active: true,
    payment_status: { in: [...EFFECTIVE_CASH_PAYMENT_STATUSES] },
    payment_method_code: { in: [...CASH_PAYMENT_METHOD_CODES] },
  };
}

/** Minimal shape needed to classify a payment row as effective cash. */
export interface CashPaymentClassifiable {
  payment_status?: string | null;
  payment_method_code?: string | null;
  is_active?: boolean | null;
}

/** True when the method code belongs to the cash family (case-insensitive). */
export function isCashFamilyMethod(code: string | null | undefined): boolean {
  return CASH_METHOD_SET.has(String(code ?? '').trim().toUpperCase());
}

/**
 * In-memory equivalent of {@link effectiveCashPaymentWhere}: active, COMPLETED
 * lifecycle, cash-family. Used where callers already hold the rows (e.g. the
 * session detail loads every linked payment for display and must sum only the
 * effective cash subset for expected-cash math).
 * @param row payment row with status/method/active markers
 */
export function isEffectiveCashPaymentRow(row: CashPaymentClassifiable): boolean {
  if (row.is_active === false) return false;
  if (!isCompletedPaymentStatus(row.payment_status)) return false;
  return isCashFamilyMethod(row.payment_method_code);
}

/**
 * Sum `amount` over the effective-cash subset of `rows`, in Decimal space
 * (POS Session & Cash Drawer Hardening, A3-7). The same drift class A3-1
 * fixed in the drawer-close write path also existed here on the
 * session-summary/close-preview *read* path: summing `Number(amount)`
 * values with JS `+` drifts for 3-decimal-currency (OMR/BHD/KWD) sequences
 * the same way `0.1 + 0.2 !== 0.3` does. Callers that feed the result into
 * further money math should use this Decimal-returning form; use
 * {@link sumEffectiveCashPayments} only at a display/API boundary.
 * @param rows payment rows (already tenant/session scoped by the caller)
 */
export function sumEffectiveCashPaymentsDecimal(
  rows: Array<CashPaymentClassifiable & { amount?: unknown }>,
): Decimal {
  return sumMoney(
    rows
      .filter((row) => isEffectiveCashPaymentRow(row))
      .map((row) => row.amount as MoneyInput),
  );
}

/**
 * Sum `amount` over the effective-cash subset of `rows`.
 * @param rows payment rows (already tenant/session scoped by the caller)
 */
export function sumEffectiveCashPayments(
  rows: Array<CashPaymentClassifiable & { amount?: unknown }>,
): number {
  return sumEffectiveCashPaymentsDecimal(rows).toNumber();
}

/**
 * Prisma `where` fragment for the B35 MANUAL movement term of expected cash.
 *
 * Sale-mirror rows (`order_payment_id` set — CASH_SALE + change) are already
 * counted via the payment ledger. B10 PAYMENT_REVERSAL rows (`reversed_payment_id`
 * set) must also stay out: reversing a cash payment already drops it from the
 * COMPLETED payment term, so counting the compensating OUT would subtract the
 * same cash twice (QA §30.2: 1.070 → −1.070). CASH_REFUND stays in — a refund
 * leaves the original payment COMPLETED, so the OUT is the only decrement.
 */
export function expectedCashManualMovementWhere(): {
  is_active: true;
  order_payment_id: null;
  reversed_payment_id: null;
  NOT: { movement_type: string };
} {
  return {
    is_active: true,
    order_payment_id: null,
    reversed_payment_id: null,
    NOT: { movement_type: CASH_DRAWER_MOVEMENT_TYPES.PAYMENT_REVERSAL },
  };
}

/** Minimal shape needed to classify a movement as the expected-cash MANUAL term. */
export interface CashMovementClassifiable {
  order_payment_id?: string | null;
  reversed_payment_id?: string | null;
  movement_type?: string | null;
  is_active?: boolean | null;
}

/**
 * In-memory equivalent of {@link expectedCashManualMovementWhere}.
 * @param row drawer movement already tenant/session scoped by the caller
 */
export function isExpectedCashManualMovement(row: CashMovementClassifiable): boolean {
  if (row.is_active === false) return false;
  if (row.order_payment_id != null) return false;
  if (row.reversed_payment_id != null) return false;
  return String(row.movement_type ?? '').toUpperCase() !== CASH_DRAWER_MOVEMENT_TYPES.PAYMENT_REVERSAL;
}
