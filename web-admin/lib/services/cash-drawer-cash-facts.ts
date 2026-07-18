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
 * Rollout note (B16): consumers apply this filter only when the tenant flag
 * `order_fin_drawer_close_v2` is enabled; with the flag off they keep the
 * legacy unfiltered aggregate (documented known M2) so the change ships as a
 * controlled, reversible rollout.
 *
 * Pure and server-safe (no prisma import): callers build their own query or
 * pass their own rows.
 */

import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { ORDER_PAYMENT_LIFECYCLE_STATUSES } from '@/lib/constants/order-financial';
import { isCompletedPaymentStatus } from '@/lib/services/order-financial-aggregation';

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

/** Convert a DB money value to a plain number (null-safe). */
function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sum `amount` over the effective-cash subset of `rows`.
 * @param rows payment rows (already tenant/session scoped by the caller)
 */
export function sumEffectiveCashPayments(
  rows: Array<CashPaymentClassifiable & { amount?: unknown }>,
): number {
  return rows.reduce((sum, row) => (isEffectiveCashPaymentRow(row) ? sum + toNumber(row.amount) : sum), 0);
}
