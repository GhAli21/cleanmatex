/**
 * B34 — Initiate-refund dialog model helpers.
 *
 * Pure client-side mirrors of the B01 service rules so the dialog can show
 * live remaining caps per source leg and validate before submitting. The
 * server (order-refund.service.ts) stays authoritative — these numbers are
 * a UX courtesy, never a substitute for the service caps.
 */

import {
  isClearlyRealPaymentRow,
  isCompletedPaymentStatus,
  toAmount,
  round4,
} from '@/lib/services/order-financial-aggregation';
import { REFUND_CONTEXTS, type RefundContext } from '@/lib/constants/order-financial';
import type {
  OrderCreditApplicationRow,
  OrderPaymentRow,
  OrderRefundRow,
} from '@/lib/services/order-financial-summary.service';

/** A refundable source leg the operator can pick (D002 v2 lineage input). */
export interface RefundLegOption {
  kind: 'PAYMENT' | 'CREDIT_APP';
  id: string;
  /** Method code (payments) or credit type (credit applications) for the label. */
  code: string;
  /** Reference / document number when available. */
  reference: string | null;
  /** Original settled amount of the leg. */
  amount: number;
  /** Amount still refundable against this leg (never negative). */
  remaining: number;
}

/**
 * Reason contexts the B34 UI offers pre-B27. REFUND_AND_REBILL is
 * intentionally absent (rejected by the API until the B27 permission code
 * ships) and MANUAL_EXCEPTION stays an API-level, permission-gated path.
 */
export const REFUND_UI_CONTEXTS = [
  REFUND_CONTEXTS.STANDARD,
  REFUND_CONTEXTS.PRICE_ADJUSTMENT_GOODWILL,
] as const satisfies readonly RefundContext[];

function sumProcessedFor(
  refunds: OrderRefundRow[],
  match: (row: OrderRefundRow) => boolean,
): number {
  return refunds.reduce((sum, row) => {
    if (row.refund_status !== 'PROCESSED') return sum;
    return match(row) ? sum + toAmount(row.refund_amount) : sum;
  }, 0);
}

/**
 * Derive the pickable source legs with live remaining caps (mirrors the B01
 * per-payment / per-credit-app cap queries on the already-loaded rows).
 * @param input.payments order payment rows (Financial tab view model)
 * @param input.creditApplications order credit application rows
 * @param input.refunds order refund rows (for consumed amounts)
 */
export function computeRefundLegOptions(input: {
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
}): { legs: RefundLegOption[]; overallRemaining: number } {
  const legs: RefundLegOption[] = [];

  for (const payment of input.payments) {
    // D005 nature filter: only REAL_PAYMENT legs are refundable payment
    // sources (stored-value redemptions arrive as credit applications below).
    if (!isCompletedPaymentStatus(payment.payment_status)) continue;
    if (!isClearlyRealPaymentRow(payment)) continue;
    const amount = toAmount(payment.amount);
    const consumed = sumProcessedFor(input.refunds, (r) => r.original_payment_id === payment.id);
    legs.push({
      kind: 'PAYMENT',
      id: payment.id,
      code: payment.payment_method_code ?? 'PAYMENT',
      reference: payment.gateway_reference ?? null,
      amount,
      remaining: Math.max(0, round4(amount - consumed)),
    });
  }

  for (const app of input.creditApplications) {
    const status = (app.application_status ?? 'APPLIED').toUpperCase();
    if (status !== 'APPLIED') continue;
    const amount = toAmount(app.applied_amount);
    const consumed = sumProcessedFor(
      input.refunds,
      (r) => r.original_credit_app_id === app.id,
    );
    legs.push({
      kind: 'CREDIT_APP',
      id: app.id,
      code: app.credit_type,
      reference: app.reference_no ?? null,
      amount,
      remaining: Math.max(0, round4(amount - consumed)),
    });
  }

  const grossApplied = legs.reduce((sum, leg) => sum + leg.amount, 0);
  const totalProcessedRefunds = sumProcessedFor(input.refunds, () => true);
  const overallRemaining = Math.max(0, round4(grossApplied - totalProcessedRefunds));

  return { legs, overallRemaining };
}

/** Validation output for the dialog form (server remains authoritative). */
export interface RefundInitiateValidation {
  valid: boolean;
  /** i18n key suffix under orders.detail.financial.refunds.initiate.errors */
  errorKey:
    | 'amountRequired'
    | 'amountExceedsLegCap'
    | 'amountExceedsOverallCap'
    | 'reasonRequiredForGoodwill'
    | null;
}

/**
 * Client-side mirror of the B01 initiate rules the dialog can explain inline
 * BEFORE submitting (no silent money mutation — invalid entries are prevented
 * with a reason, never rewritten).
 * @param input.amount operator-entered refund amount
 * @param input.selectedLeg chosen source leg, or null for a goodwill refund
 * @param input.overallRemaining order-level refundable balance
 * @param input.notes reason text (mandatory for goodwill per D002 v2)
 */
export function validateRefundInitiate(input: {
  amount: number;
  selectedLeg: RefundLegOption | null;
  overallRemaining: number;
  notes: string;
}): RefundInitiateValidation {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { valid: false, errorKey: 'amountRequired' };
  }
  if (input.selectedLeg && input.amount > input.selectedLeg.remaining) {
    return { valid: false, errorKey: 'amountExceedsLegCap' };
  }
  if (input.amount > input.overallRemaining) {
    return { valid: false, errorKey: 'amountExceedsOverallCap' };
  }
  if (!input.selectedLeg && !input.notes.trim()) {
    return { valid: false, errorKey: 'reasonRequiredForGoodwill' };
  }
  return { valid: true, errorKey: null };
}

/**
 * One idempotency key per dialog attempt (B01 §12): generated when the dialog
 * opens and reused across retries of the same submission, so a double-click or
 * network retry replays instead of double-refunding.
 */
export function createRefundAttemptKey(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `ui-refund-${random}`;
}
