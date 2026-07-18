/**
 * Order Financial Aggregation — the single D005 aggregation authority (B02).
 *
 * Why this module exists:
 * Snapshot, reconciliation, receipts, order summary, customer balance, and AR
 * sizing historically re-derived "outstanding" with drifting component
 * definitions (literal status strings, any-active credit filters, blanket
 * refund reopening — audit finding C2). D005 (APPROVED Expert, 2026-07-16)
 * froze ONE formula with ONE set of component definitions, implemented here
 * and consumed everywhere. No consumer may substitute its own status set or
 * row filter (D005 invariant 2); changing any definition below requires a
 * superseding decision, not a code edit (invariant 5).
 *
 * The frozen formula (D005 §Component definitions):
 *
 *   effectivePayments = Σ payments  WHERE is_active AND nature = REAL_PAYMENT
 *                                     AND payment_status ∈ {COMPLETED, CAPTURED, SETTLED}
 *   effectiveCredits  = Σ credits   WHERE is_active AND application_status = APPLIED
 *   refundReopens     = Σ refunds.reopens_due_amount WHERE is_active AND PROCESSED
 *                       (values per D003 v2 — positive only for explicit
 *                        REFUND_AND_REBILL / MANUAL_EXCEPTION rows)
 *   creditRevReopens  = Σ credit-reversal reopens (per D006; currently 0)
 *
 *   outstanding = max(0, round4(total − effectivePayments − effectiveCredits
 *                                + refundReopens + creditRevReopens))
 *
 * Pending / authorized / failed amounts are REPORTED BUCKETS only — never part
 * of paid or outstanding (grounds B33 / M9).
 *
 * This module is intentionally pure (no prisma, no 'server-only'): callers
 * fetch their own `is_active = true` rows and pass them in, so the same
 * definitions serve the in-transaction snapshot writer, the reconciliation
 * pipeline, and read-side fallbacks (client-safe).
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

import {
  CREDIT_APPLICATION_STATUSES,
  LEGACY_REFUND_SOURCE_TYPES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  REFUND_METHODS,
  REFUND_SOURCE_TYPES,
} from '@/lib/constants/order-financial';

/** Any DB-sourced money value the aggregation accepts. */
export type AmountLike = Decimal | number | string | null | undefined;

/**
 * D005 invariant 4: order-level monetary comparison tolerance. The drawer
 * physical-count tolerance is a separate, documented constant — do not merge
 * them.
 */
export const ORDER_FINANCIAL_COMPARISON_TOLERANCE = 0.001;

/** Convert a DB money value to a plain number (null-safe). */
export function toAmount(value: AmountLike): number {
  if (value == null) return 0;
  return Number(value);
}

/** Round to the DECIMAL(19,4) money precision used across Order Fin. */
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function normalizeUpper(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ── Payments ─────────────────────────────────────────────────────────────────

/**
 * Payment row shape the aggregation understands. All marker fields are
 * optional so both the snapshot writer's projection and lighter read-side
 * projections satisfy the type; absent markers simply do not vote.
 */
export type AggregationPaymentRow = {
  amount: AmountLike;
  payment_status: string | null;
  payment_nature_snapshot?: string | null;
  payment_method_code?: string | null;
  org_payment_method_id?: string | null;
  branch_payment_method_id?: string | null;
  gateway_code?: string | null;
  gateway_reference?: string | null;
  tendered_amount?: AmountLike;
  check_no?: string | null;
  bank_reference?: string | null;
};

/**
 * D005 nature filter: a row participates in effectivePayments only when it is
 * clearly a REAL_PAYMENT leg. The persisted `payment_nature_snapshot` is
 * authoritative when present; otherwise any concrete payment marker
 * (method/gateway/tender/check/bank reference) qualifies the row. This is the
 * canonical union of the pre-B02 writer and read-fallback marker sets — one
 * definition, everywhere.
 */
export function isClearlyRealPaymentRow(row: AggregationPaymentRow): boolean {
  const snapshotNature = normalizeUpper(row.payment_nature_snapshot);
  if (snapshotNature === 'REAL_PAYMENT') return true;
  if (snapshotNature && snapshotNature !== 'REAL_PAYMENT') return false;

  return Boolean(
    row.org_payment_method_id
      || row.branch_payment_method_id
      || row.payment_method_code?.trim()
      || row.gateway_code?.trim()
      || row.gateway_reference?.trim()
      || row.tendered_amount != null
      || row.check_no?.trim()
      || row.bank_reference?.trim(),
  );
}

/** True when the status belongs to the frozen COMPLETED lifecycle set. */
export function isCompletedPaymentStatus(status: string | null | undefined): boolean {
  return (ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED as readonly string[]).includes(
    normalizeUpper(status),
  );
}

/**
 * Sum real-payment rows whose lifecycle status is in `allowedStatuses`.
 * Callers pass `is_active = true` rows (the aggregation never sees soft-
 * deleted facts).
 */
export function sumPaymentsByStatuses(
  rows: AggregationPaymentRow[],
  allowedStatuses: readonly string[],
): number {
  const allowed = new Set<string>(allowedStatuses);
  return rows.reduce((sum, row) => {
    if (!allowed.has(normalizeUpper(row.payment_status))) return sum;
    if (!isClearlyRealPaymentRow(row)) return sum;
    return sum + toAmount(row.amount);
  }, 0);
}

/** D005 effectivePayments — COMPLETED-set, nature-filtered payment total. */
export function sumEffectivePayments(rows: AggregationPaymentRow[]): number {
  return sumPaymentsByStatuses(rows, ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED);
}

/**
 * A historical payment row with no persisted nature and no marker is
 * ambiguous — surfaced as a snapshot warning, never silently classified.
 */
export function hasAmbiguousHistoricalPaymentRow(rows: AggregationPaymentRow[]): boolean {
  return rows.some((row) => {
    if (row.payment_nature_snapshot != null) return false;
    return !isClearlyRealPaymentRow(row);
  });
}

// ── Credit applications ──────────────────────────────────────────────────────

/** Credit-application row shape the aggregation understands. */
export type AggregationCreditRow = {
  applied_amount: AmountLike;
  application_status?: string | null;
};

/**
 * Sum credit applications whose lifecycle status is in `allowedStatuses`.
 * A NULL status is treated as APPLIED (pre-lifecycle historical rows).
 */
export function sumCreditsByStatuses(
  rows: AggregationCreditRow[],
  allowedStatuses: readonly string[],
): number {
  const allowed = new Set<string>(allowedStatuses);
  return rows.reduce((sum, row) => {
    const status = normalizeUpper(row.application_status) || CREDIT_APPLICATION_STATUSES.APPLIED;
    if (!allowed.has(status)) return sum;
    return sum + toAmount(row.applied_amount);
  }, 0);
}

/** D005 effectiveCredits — APPLIED-only credit total. */
export function sumEffectiveCredits(rows: AggregationCreditRow[]): number {
  return sumCreditsByStatuses(rows, [CREDIT_APPLICATION_STATUSES.APPLIED]);
}

// ── Refunds ──────────────────────────────────────────────────────────────────

/**
 * Refund fact row consumed by classification and the reopen term. Moved here
 * from the snapshot writer in B02 so read-side fallbacks share the identical
 * classification instead of re-deriving their own (D005 invariant 1).
 */
export type RefundFactRow = {
  refund_amount: AmountLike;
  refund_status: string | null;
  refund_method_code: string | null;
  original_payment_id: string | null;
  refund_source_type: string | null;
  reopens_due_amount: AmountLike;
  metadata: Prisma.JsonValue;
};

/**
 * D005 refundReopens — Σ reopens_due_amount over PROCESSED refund rows.
 * Values are policy-populated per D003 v2: positive only on explicit
 * REFUND_AND_REBILL / MANUAL_EXCEPTION rows; commercial refunds carry 0.
 */
export function sumRefundReopens(rows: Array<Pick<RefundFactRow, 'refund_status' | 'reopens_due_amount'>>): number {
  return rows.reduce((sum, row) => {
    if (normalizeUpper(row.refund_status) !== 'PROCESSED') return sum;
    return sum + toAmount(row.reopens_due_amount);
  }, 0);
}

/** Σ refund_amount over PROCESSED rows (caps + REFUND_CONSISTENCY input). */
export function sumProcessedRefunds(rows: Array<Pick<RefundFactRow, 'refund_status' | 'refund_amount'>>): number {
  return rows.reduce((sum, row) => {
    if (normalizeUpper(row.refund_status) !== 'PROCESSED') return sum;
    return sum + toAmount(row.refund_amount);
  }, 0);
}

/**
 * Bucket PROCESSED refund rows into the snapshot's refund aggregates.
 *
 * B01 (D002 v2): buckets are exclusive per row and driven by the ORIGIN facet
 * (`refund_source_type`) — REAL_PAYMENT_REFUND reduces net collected,
 * *_RESTORE rows are stored-value restorations, GOODWILL_CONCESSION counts as
 * issued customer credit only when its destination actually issues one
 * (CREDIT_NOTE); MANUAL_EXCEPTION keeps the unclassified warning. The retired
 * CUSTOMER_CREDIT_ISSUE / CREDIT_NOTE_ISSUE values remain readable for rows
 * written before migration 0404. Legacy NULL-source rows fall back to the
 * pre-0340 method/metadata heuristic (synthetic-only after 0404).
 * @param refunds `is_active = true` refund fact rows
 */
export function classifyRefunds(refunds: RefundFactRow[]): {
  refundedAmount: number;
  realPaymentRefundedAmount: number;
  storedValueRestoredAmount: number;
  customerCreditIssuedAmount: number;
  hasUnclassifiedRefundSource: boolean;
  refundReopensDueAmount: number;
} {
  let refundedAmount = 0;
  let realPaymentRefundedAmount = 0;
  let storedValueRestoredAmount = 0;
  let customerCreditIssuedAmount = 0;
  let hasUnclassifiedRefundSource = false;

  for (const refund of refunds) {
    if (normalizeUpper(refund.refund_status) !== 'PROCESSED') continue;

    const amount = toAmount(refund.refund_amount);
    refundedAmount += amount;

    const sourceType = normalizeUpper(refund.refund_source_type);

    if (sourceType) {
      if (sourceType === REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND) {
        realPaymentRefundedAmount += amount;
      } else if (
        sourceType === REFUND_SOURCE_TYPES.GIFT_CARD_RESTORE
        || sourceType === REFUND_SOURCE_TYPES.WALLET_RESTORE
        || sourceType === REFUND_SOURCE_TYPES.CUSTOMER_ADVANCE_RESTORE
        || sourceType === REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE
      ) {
        storedValueRestoredAmount += amount;
      } else if (sourceType === REFUND_SOURCE_TYPES.GOODWILL_CONCESSION) {
        // No prior settlement leg: nothing was collected, so net collected is
        // untouched. Only a credit-note destination issues trackable customer
        // credit; cash/original/wallet goodwill counts in refundedAmount only.
        if (normalizeUpper(refund.refund_method_code) === REFUND_METHODS.CREDIT_NOTE) {
          customerCreditIssuedAmount += amount;
        }
      } else if (
        sourceType === LEGACY_REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_ISSUE
        || sourceType === LEGACY_REFUND_SOURCE_TYPES.CREDIT_NOTE_ISSUE
      ) {
        // Retired pre-0404 destination-named sources — read-only compatibility.
        customerCreditIssuedAmount += amount;
      } else if (sourceType === REFUND_SOURCE_TYPES.MANUAL_EXCEPTION) {
        hasUnclassifiedRefundSource = true;
      }
      continue;
    }

    // Legacy heuristic fallback (pre-0340 rows — synthetic-only post-0404).
    const method = normalizeUpper(refund.refund_method_code);
    const metadata = toRecord(refund.metadata);
    const refundDestinationType = String(metadata.refund_destination_type ?? '').trim().toUpperCase();
    const originalCreditType = String(metadata.original_credit_type ?? '').trim().toUpperCase();

    if (
      method === REFUND_METHODS.CASH
      || method === REFUND_METHODS.ORIGINAL_METHOD
      || Boolean(refund.original_payment_id)
    ) {
      realPaymentRefundedAmount += amount;
      continue;
    }

    if (
      method === REFUND_METHODS.WALLET
      || refundDestinationType === 'STORED_VALUE'
      || ['GIFT_CARD', 'WALLET', 'CUSTOMER_ADVANCE', 'ADVANCE', 'LOYALTY_CREDIT', 'LOYALTY_POINTS'].includes(originalCreditType)
    ) {
      storedValueRestoredAmount += amount;
      continue;
    }

    if (
      method === REFUND_METHODS.CREDIT_NOTE
      || refundDestinationType === 'CUSTOMER_CREDIT'
    ) {
      customerCreditIssuedAmount += amount;
      continue;
    }

    hasUnclassifiedRefundSource = true;
  }

  return {
    refundedAmount,
    realPaymentRefundedAmount,
    storedValueRestoredAmount,
    customerCreditIssuedAmount,
    hasUnclassifiedRefundSource,
    refundReopensDueAmount: sumRefundReopens(refunds),
  };
}

// ── The canonical outstanding formula ───────────────────────────────────────

/** Inputs for the frozen D005 outstanding formula. */
export interface OutstandingInput {
  totalAmount: number;
  effectivePayments: number;
  effectiveCredits: number;
  refundReopens: number;
  /** Per D006 — currently always 0 until credit-reversal reopen semantics land. */
  creditReversalReopens: number;
}

/**
 * outstanding = max(0, round4(total − effectivePayments − effectiveCredits
 *                              + refundReopens + creditRevReopens))
 *
 * The one formula (D005). Every consumer — snapshot writer, reconciliation,
 * read fallbacks — must arrive at outstanding through this function.
 * @param input frozen-component values (derive them with the sums above)
 */
export function computeOutstanding(input: OutstandingInput): number {
  return Math.max(
    0,
    round4(
      input.totalAmount
        - input.effectivePayments
        - input.effectiveCredits
        + input.refundReopens
        + input.creditReversalReopens,
    ),
  );
}

/**
 * Convenience: derive every frozen component plus outstanding from raw fact
 * rows in one call (used by reconciliation and the equality regression suite).
 * @param input.totalAmount canonical order total
 * @param input.payments `is_active = true` payment rows
 * @param input.credits `is_active = true` credit-application rows
 * @param input.refunds `is_active = true` refund rows
 * @param input.creditReversalReopens per D006 (default 0)
 */
export function aggregateOrderFinancials(input: {
  totalAmount: number;
  payments: AggregationPaymentRow[];
  credits: AggregationCreditRow[];
  refunds: Array<Pick<RefundFactRow, 'refund_status' | 'refund_amount' | 'reopens_due_amount'>>;
  creditReversalReopens?: number;
}): {
  effectivePayments: number;
  effectiveCredits: number;
  refundReopens: number;
  processedRefunds: number;
  creditReversalReopens: number;
  outstanding: number;
} {
  const effectivePayments = sumEffectivePayments(input.payments);
  const effectiveCredits = sumEffectiveCredits(input.credits);
  const refundReopens = sumRefundReopens(input.refunds);
  const processedRefunds = sumProcessedRefunds(input.refunds);
  const creditReversalReopens = input.creditReversalReopens ?? 0;

  return {
    effectivePayments,
    effectiveCredits,
    refundReopens,
    processedRefunds,
    creditReversalReopens,
    outstanding: computeOutstanding({
      totalAmount: input.totalAmount,
      effectivePayments,
      effectiveCredits,
      refundReopens,
      creditReversalReopens,
    }),
  };
}
