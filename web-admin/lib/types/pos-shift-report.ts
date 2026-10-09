import type {
  PosSessionCurrencyTotal,
  PosSessionOrdersCreated,
  PosSessionSummaryGroupedAmountRow,
  PosSessionVoucherLineSummaryRow,
} from '@/lib/types/pos-session';
import type { PosShiftReportKind } from '@/lib/constants/pos-shift-report';

/**
 * Types of the POS shift report (D2). Every money value is an exact fixed-point string straight
 * from a `::text` aggregate — never a JS number — so a printed report can never drift by a float.
 */

/** Cash that moved through the drawer for this shift in one currency (cash-effect voucher lines). */
export interface PosShiftCashRow {
  currencyCode: string | null;
  cashIn: string;
  cashOut: string;
  /** cashIn − cashOut, computed by the database. */
  net: string;
  lineCount: number;
}

/** Net cash-change rounding the business absorbed in one currency (CASH_CHANGE_ROUNDING lines). */
export interface PosShiftRoundingRow {
  currencyCode: string | null;
  /** IN − OUT of the rounding lines: negative = the business gave more change than owed. */
  net: string;
  lineCount: number;
}

/** One currency of the linked drawer session's balance ledger. */
export interface PosShiftDrawerBalanceRow {
  currencyCode: string;
  openingExpected: string | null;
  openingCounted: string | null;
  finIn: string | null;
  finOut: string | null;
  trxIn: string | null;
  trxOut: string | null;
  closingExpected: string | null;
  closingCounted: string | null;
  closingVariance: string | null;
}

/** Cash handled by one POS session inside the linked drawer session; `posSessionId = null` is unattributed cash. */
export interface PosShiftCashAttributionRow {
  posSessionId: string | null;
  posSessionNo: string | null;
  operatorName: string | null;
  currencyCode: string;
  cashIn: string;
  cashOut: string;
  net: string;
  lineCount: number;
}

/** The cash-drawer session the POS session was linked to, with its per-currency balances. */
export interface PosShiftDrawerFigures {
  sessionId: string;
  sessionNo: string;
  drawerName: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
  /** True when a closing variance tripped its threshold and still has no approval or rejection. */
  variancePending: boolean;
  varianceApproved: boolean;
  varianceRejected: boolean;
  balances: PosShiftDrawerBalanceRow[];
  /**
   * E2-3: cash taken and paid out per POS session inside this drawer session (several cashiers can share one),
   * so a drawer variance can be traced to a shift. Absent in snapshots frozen before it existed.
   */
  attribution?: PosShiftCashAttributionRow[];
}

/** Identity and window of the reported shift. */
export interface PosShiftSessionFacts {
  id: string;
  sessionNo: string;
  businessDate: string;
  businessTimezone: string;
  status: string;
  branchId: string;
  branchName: string | null;
  operatorUserId: string;
  operatorName: string | null;
  openedAt: string;
  /** Null while the shift is live (an X-report of an open session). */
  closedAt: string | null;
  autoCloseReason: string | null;
}

/** The versioned body of an X- or Z-report. Stored verbatim as `org_pos_shift_z_rpt_tr.snapshot` for Z. */
export interface PosShiftReportSnapshot {
  version: number;
  kind: PosShiftReportKind;
  generatedAt: string;
  session: PosShiftSessionFacts;
  payments: { totals: PosSessionCurrencyTotal[]; byMethod: PosSessionSummaryGroupedAmountRow[] };
  refunds: { totals: PosSessionCurrencyTotal[]; byMethod: PosSessionSummaryGroupedAmountRow[] };
  voucherLines: { totals: PosSessionCurrencyTotal[]; byRole: PosSessionVoucherLineSummaryRow[] };
  /** Present from snapshot version 2. Absent on Z-reports frozen before orders-created was recorded. */
  ordersCreated?: PosSessionOrdersCreated;
  cash: { byCurrency: PosShiftCashRow[]; changeRounding: PosShiftRoundingRow[] };
  drawer: PosShiftDrawerFigures | null;
}

/** A stored Z-report: the snapshot plus the row facts that make it verifiable and printable. */
export interface PosShiftZReport {
  id: string;
  reportNo: string;
  posSessionId: string;
  branchId: string;
  businessDate: string;
  sessionStatus: string;
  generatedAt: string;
  generatedBy: string;
  snapshotHash: string;
  /** True when the stored hash still equals the SHA-256 of the stored snapshot (always, unless tampered). */
  hashVerified: boolean;
  snapshot: PosShiftReportSnapshot;
}

/** Closing variance of one drawer currency, as frozen in a Z-report. */
export interface PosShiftZArchiveVariance {
  currencyCode: string;
  /** Counted minus expected at close, exact fixed-point string; null when no closing count was frozen. */
  variance: string | null;
}

/** One line of the Z-report archive: the headline figures of a frozen shift, without the full snapshot. */
export interface PosShiftZArchiveRow {
  id: string;
  reportNo: string;
  posSessionId: string;
  sessionNo: string | null;
  branchId: string;
  branchName: string | null;
  operatorUserId: string;
  operatorName: string | null;
  businessDate: string;
  businessTimezone: string;
  openedAt: string;
  closedAt: string;
  generatedAt: string;
  /** True when the session was closed by the rollover job rather than a person. */
  autoClosed: boolean;
  /** Payments taken, one entry per currency. */
  sales: PosSessionCurrencyTotal[];
  /** Linked drawer-session closing variance per currency (empty when the shift had no drawer). */
  drawerVariance: PosShiftZArchiveVariance[];
  /** True when a drawer variance tripped its threshold and still has no approval or rejection. */
  variancePending: boolean;
  /** Stored hash still equals the SHA-256 of the stored snapshot (false = the report was altered). */
  hashVerified: boolean;
}

/** A page of the Z-report archive. */
export interface PosShiftZArchivePage {
  items: PosShiftZArchiveRow[];
  total: number;
  page: number;
  pageSize: number;
}
