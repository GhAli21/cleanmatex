/**
 * D-09 — Finance reconciliation report constants.
 *
 * Identifiers and source categories for the four launch-required reconciliation
 * reports (unallocated excess / customer stored-value liability, B2B statement
 * payment, overpayment disposition, cash drawer movement).
 *
 * These reports are READ-ONLY over existing finance tables — no new DB objects.
 * The DB-backed values they group by (overpayment resolution codes, cash-drawer
 * movement directions) are imported from their canonical DB-mirror constants
 * rather than re-declared here, per the DB-mirror rule.
 */

/** Report identifiers — drive the API route segment and the UI tab key. */
export const RECONCILIATION_REPORT_KEYS = {
  EXCESS_LIABILITY: 'excess_liability',
  B2B_STATEMENTS: 'b2b_statements',
  OVERPAYMENT_DISPOSITION: 'overpayment_disposition',
  CASH_DRAWER: 'cash_drawer',
} as const;

export type ReconciliationReportKey =
  (typeof RECONCILIATION_REPORT_KEYS)[keyof typeof RECONCILIATION_REPORT_KEYS];

/**
 * Stored-value source buckets for the unallocated-excess liability report.
 * Report-internal categorisation (not a DB column value) — each maps to one
 * customer stored-value table whose positive balance is an outstanding,
 * unallocated liability the tenant still owes the customer.
 */
export const EXCESS_LIABILITY_SOURCES = {
  WALLET: 'WALLET',
  ADVANCE: 'ADVANCE',
  CREDIT_NOTE: 'CREDIT_NOTE',
} as const;

export type ExcessLiabilitySource =
  (typeof EXCESS_LIABILITY_SOURCES)[keyof typeof EXCESS_LIABILITY_SOURCES];

/**
 * Drift tolerance for flagging a reconciliation exception (header vs detail,
 * expected vs counted). Mirrors `RECONCILIATION_TOLERANCE` (0.01) used by the
 * BVM reconciliation engine so reports and the engine agree on what "balanced"
 * means.
 */
export const RECON_REPORT_EPSILON = 0.01;
