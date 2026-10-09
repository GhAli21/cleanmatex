import type { Database } from '@/types/database.generated';

/** Persisted POS session record as generated from the database schema. */
export type PosSessionRow =
  Database['public']['Tables']['org_pos_sessions_mst']['Row'];

/** Persisted immutable lifecycle event for a POS session. */
export type PosSessionEventRow =
  Database['public']['Tables']['org_pos_session_events_dtl']['Row'];

/**
 * Presentation context used by POS operational screens.
 *
 * Drawer fields are permission-sensitive and must be nulled by the API unless
 * the caller has cash drawer view access.
 */
export interface PosSessionContextFields {
  branch_name: string | null;
  branch_name2: string | null;
  terminal_name: string | null;
  terminal_code: string | null;
  cash_drawer_name: string | null;
  cash_drawer_session_no: string | null;
  cash_drawer_session_status: string | null;
  /** Counted opening cash when a count exists, otherwise the expected carry-forward. */
  cash_drawer_opening_balance: number | null;
  /** Drawer-ledger cash in since this session opened (voucher IN + custody IN). Null when no drawer is linked. */
  cash_drawer_total_in: number | null;
  /** Drawer-ledger cash out since this session opened (voucher OUT + custody OUT). Null when no drawer is linked. */
  cash_drawer_total_out: number | null;
  /** Opening balance plus total in minus total out, in the drawer currency. Null when no drawer is linked. */
  cash_drawer_current_balance: number | null;
  cash_drawer_currency_code: string | null;
  user_display_name: string | null;
  opened_by_display_name: string | null;
  paused_by_display_name: string | null;
  closed_by_display_name: string | null;
  force_closed_by_display_name: string | null;
  created_by_display_name: string | null;
  updated_by_display_name: string | null;
}

/** POS session enriched with tenant-scoped display values for operational UI. */
export type PosSessionWithContext = PosSessionRow & PosSessionContextFields;

/** Explains why the caller cannot use its requested branch with an active session. */
export interface PosSessionBranchConflict {
  type: 'BRANCH_CONFLICT';
  requestedBranchId: string;
  activeBranchId: string;
  activeSession: PosSessionRow | PosSessionWithContext;
}

/** Indicates that the user has no active POS session. */
export interface PosSessionNoneResult {
  type: 'NONE';
}

/** Contains the user's currently active POS session. */
export interface PosSessionActiveResult {
  type: 'ACTIVE';
  session: PosSessionRow | PosSessionWithContext;
}

/** Indicates that a new POS session was created. */
export interface PosSessionCreatedResult {
  type: 'CREATED';
  session: PosSessionRow;
}

/** Indicates that an idempotent open request found the existing session. */
export interface PosSessionCurrentResult {
  type: 'CURRENT';
  session: PosSessionRow;
}

/** Indicates that a lifecycle command changed the session. */
export interface PosSessionUpdatedResult {
  type: 'UPDATED';
  session: PosSessionRow;
}

/** Indicates that a repeat lifecycle command required no state change. */
export interface PosSessionNoopResult {
  type: 'NOOP';
  session: PosSessionRow;
}

/** Result of resolving a user's active session within an optional branch. */
export type GetMyActivePosSessionResult =
  | PosSessionNoneResult
  | PosSessionActiveResult
  | PosSessionBranchConflict;

/** Result of an open or ensure-session request. */
export type OpenPosSessionResult =
  | PosSessionCreatedResult
  | PosSessionCurrentResult
  | PosSessionBranchConflict;

/** Result of a pause, resume, close, or force-close command. */
export type PosSessionLifecycleResult =
  | PosSessionUpdatedResult
  | PosSessionNoopResult;

/** Response shapes eligible for persistence in the idempotency cache. */
export type PosSessionIdempotentResult =
  | GetMyActivePosSessionResult
  | OpenPosSessionResult
  | PosSessionLifecycleResult;

/** Extensible event/session context retained without changing the core schema. */
export type PosSessionMetadata = Record<string, unknown>;

/** Operational list row including resolved names rather than opaque IDs alone. */
export type PosSessionListRow = PosSessionWithContext;

/** Server-paged POS session history response. */
export interface PosSessionListResult {
  items: PosSessionListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Controls whether history reads include soft-deactivated records.
 *
 * This intentionally remains separate from POS lifecycle `status`: a closed
 * session can still be an active record, while an inactive record is excluded
 * from normal operational views regardless of its lifecycle state.
 */
export type PosSessionRecordState = 'active' | 'all';

/** Kinds of POS-session dimensions selectable by a list-of-values control. */
export type PosSessionFilterOptionType =
  | 'branch'
  | 'operator'
  | 'terminal'
  | 'cashDrawer'
  | 'cashDrawerSession';

/** Tenant-scoped selectable value returned by the POS-session lookup endpoint. */
export interface PosSessionFilterOption {
  id: string;
  label: string;
  label2: string | null;
  secondaryLabel: string | null;
}

/** Server-paged result for one POS-session filter dimension. */
export interface PosSessionFilterOptionsResult {
  type: PosSessionFilterOptionType;
  items: PosSessionFilterOption[];
  total: number;
  page: number;
  pageSize: number;
}

/** Session event enriched with tenant-scoped actor display names. */
export interface PosSessionEventListRow extends PosSessionEventRow {
  performed_by_display_name: string | null;
  created_by_display_name: string | null;
  updated_by_display_name: string | null;
}

/** Server-paged audit-event response for one authorized session. */
export interface PosSessionEventListResult {
  items: PosSessionEventListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PosSessionSummaryAmountRow {
  currencyCode: string | null;
  /**
   * A3-4: exact fixed-point string (e.g. `'25.5000'`), never a JS number —
   * the raw SQL aggregate is already computed as exact `NUMERIC` and cast to
   * `::text` server-side; converting it to a JS `number` at the API boundary
   * would reintroduce the same double-precision rounding that cast exists to
   * avoid. Consumers format for display via `formatMoneyAmount`/
   * `useCashDrawerMoneyFormatter`, which accept this string form directly.
   */
  amount: string;
  count: number;
}

/**
 * A4-1 (POS Session & Cash Drawer Hardening) — one currency's total within a
 * summary category. Previously `getPosSessionSummary` computed this with
 * `GROUP BY currency_code ... LIMIT 1`, which silently dropped every
 * currency but one for a mixed-currency session. Now always an array: one
 * entry for a single-currency session (D14 — no UI change for the common
 * case), more than one when the session genuinely mixed currencies.
 */
export type PosSessionCurrencyTotal = PosSessionSummaryAmountRow;

/** Amount split by an operational grouping and status. */
export interface PosSessionSummaryGroupedAmountRow extends PosSessionSummaryAmountRow {
  groupCode: string | null;
  status: string | null;
}

/** Voucher amount split by its financial role and payment context. */
export interface PosSessionVoucherLineSummaryRow extends PosSessionSummaryAmountRow {
  lineRole: string | null;
  paymentMethodCode: string | null;
  direction: string | null;
}

/** Linked drawer cash for a POS session summary. Null when no drawer session is linked. */
export interface PosSessionDrawerCashStatement {
  currencyCode: string | null;
  /** Counted opening cash when a count exists, otherwise the expected carry-forward. */
  openingBalance: string | null;
  /** Counted cash at close when the drawer was counted, otherwise opening plus live drawer movements. */
  finalBalance: string | null;
}

/** Financial roll-up for a session without mutating its settled facts. */
export interface PosSessionSummary {
  session: PosSessionRow;
  drawerCash: PosSessionDrawerCashStatement | null;
  payments: {
    totals: PosSessionCurrencyTotal[];
    byMethod: PosSessionSummaryGroupedAmountRow[];
  };
  refunds: {
    totals: PosSessionCurrencyTotal[];
    byMethod: PosSessionSummaryGroupedAmountRow[];
  };
  voucherLines: {
    totals: PosSessionCurrencyTotal[];
    byRole: PosSessionVoucherLineSummaryRow[];
  };
}
