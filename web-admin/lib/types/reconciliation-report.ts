/**
 * D-09 — Finance reconciliation report row + summary types.
 *
 * One row/summary shape per report. Money values are transported as `number`
 * (float8) — these are read-only reporting projections, not posting paths;
 * the authoritative DECIMAL(19,4) values stay in the DB.
 */

import type { OverpaymentResolutionCode } from '@/lib/constants/settlement-catalog';
import type { ExcessLiabilitySource } from '@/lib/constants/reconciliation-reports';

/** Shared filter accepted by every reconciliation report query. */
export interface ReconReportFilter {
  tenantOrgId: string;
  /** Inclusive lower bound (ISO date) applied to each report's anchor timestamp. */
  from?: string;
  /** Inclusive upper bound (ISO date). */
  to?: string;
  /** Optional branch scope; only applied by reports whose source carries branch_id. */
  branchId?: string;
}

// ── 1. Unallocated excess / customer stored-value liability ──────────────────

export interface ExcessLiabilityRow {
  customerId: string;
  customerName: string | null;
  source: ExcessLiabilitySource;
  currencyCode: string | null;
  /** Outstanding, unallocated balance still owed to the customer (> 0). */
  outstandingAmount: number;
  lastActivityAt: string | null;
}

export interface ExcessLiabilitySummary {
  totalOutstanding: number;
  walletTotal: number;
  advanceTotal: number;
  creditNoteTotal: number;
  rowCount: number;
}

export interface ExcessLiabilityReport {
  rows: ExcessLiabilityRow[];
  summary: ExcessLiabilitySummary;
}

// ── 2. B2B statement payment reconciliation ──────────────────────────────────

export interface B2bStatementReconRow {
  statementId: string;
  statementNo: string;
  customerId: string;
  currencyCode: string | null;
  statusCode: string | null;
  totalAmount: number;
  /** `paid_amount` on the statement header. */
  headerPaidAmount: number;
  balanceAmount: number;
  /** Sum of applied payments in `org_b2b_statement_payments_dtl`. */
  detailPaidAmount: number;
  /** `headerPaidAmount - detailPaidAmount`; non-zero (> epsilon) = exception. */
  delta: number;
  isReconciled: boolean;
  detailRowCount: number;
}

export interface B2bStatementReconSummary {
  statementCount: number;
  exceptionCount: number;
  totalHeaderPaid: number;
  totalDetailPaid: number;
  totalDelta: number;
}

export interface B2bStatementReconReport {
  rows: B2bStatementReconRow[];
  summary: B2bStatementReconSummary;
}

// ── 3. Overpayment disposition reconciliation ────────────────────────────────

export interface OverpaymentDispositionReconRow {
  resolutionCode: OverpaymentResolutionCode | string;
  currencyCode: string | null;
  count: number;
  totalAmount: number;
  /** Rows carrying a `voucher_trx_line_id` (authoritative posting linked). */
  postedCount: number;
  postedAmount: number;
  /** Rows with no voucher-line link — reconciliation exceptions. */
  orphanCount: number;
  orphanAmount: number;
}

export interface OverpaymentDispositionReconSummary {
  totalCount: number;
  totalAmount: number;
  orphanCount: number;
  orphanAmount: number;
}

export interface OverpaymentDispositionReconReport {
  rows: OverpaymentDispositionReconRow[];
  summary: OverpaymentDispositionReconSummary;
}

// ── 4. Cash drawer movement reconciliation ───────────────────────────────────

export interface CashDrawerReconRow {
  sessionId: string;
  sessionNo: string;
  status: string;
  currencyCode: string | null;
  openedAt: string;
  closedAt: string | null;
  openingFloatAmount: number;
  /** Net of movement rows for the session (Σ IN − Σ OUT). */
  netMovementAmount: number;
  /** openingFloat + netMovement — recomputed expected from movement rows. */
  computedExpectedAmount: number;
  /** `expected_cash_amount` stored on the session header. */
  headerExpectedAmount: number;
  countedCashAmount: number | null;
  /** Session `difference_amount` (counted − expected), null while OPEN. */
  differenceAmount: number | null;
  /** computedExpected vs headerExpected drift (> epsilon = exception). */
  expectedDelta: number;
  /** Movements in the session lacking a fin_voucher backlink (BVM trail gap). */
  unlinkedMovementCount: number;
  isReconciled: boolean;
}

export interface CashDrawerReconSummary {
  sessionCount: number;
  exceptionCount: number;
  totalDifference: number;
  totalUnlinkedMovements: number;
}

export interface CashDrawerReconReport {
  rows: CashDrawerReconRow[];
  summary: CashDrawerReconSummary;
}
