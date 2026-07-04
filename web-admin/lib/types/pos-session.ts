import type { Database } from '@/types/database.generated';

export type PosSessionRow =
  Database['public']['Tables']['org_pos_sessions_mst']['Row'];

export type PosSessionEventRow =
  Database['public']['Tables']['org_pos_session_events_dtl']['Row'];

export interface PosSessionBranchConflict {
  type: 'BRANCH_CONFLICT';
  requestedBranchId: string;
  activeBranchId: string;
  activeSession: PosSessionRow;
}

export interface PosSessionNoneResult {
  type: 'NONE';
}

export interface PosSessionActiveResult {
  type: 'ACTIVE';
  session: PosSessionRow;
}

export interface PosSessionCreatedResult {
  type: 'CREATED';
  session: PosSessionRow;
}

export interface PosSessionCurrentResult {
  type: 'CURRENT';
  session: PosSessionRow;
}

export interface PosSessionUpdatedResult {
  type: 'UPDATED';
  session: PosSessionRow;
}

export interface PosSessionNoopResult {
  type: 'NOOP';
  session: PosSessionRow;
}

export type GetMyActivePosSessionResult =
  | PosSessionNoneResult
  | PosSessionActiveResult
  | PosSessionBranchConflict;

export type OpenPosSessionResult =
  | PosSessionCreatedResult
  | PosSessionCurrentResult
  | PosSessionBranchConflict;

export type PosSessionLifecycleResult =
  | PosSessionUpdatedResult
  | PosSessionNoopResult;

export type PosSessionIdempotentResult =
  | GetMyActivePosSessionResult
  | OpenPosSessionResult
  | PosSessionLifecycleResult;

export type PosSessionMetadata = Record<string, unknown>;

export interface PosSessionListRow extends PosSessionRow {
  branch_name: string | null;
  branch_name2: string | null;
  terminal_name: string | null;
  terminal_code: string | null;
  cash_drawer_name: string | null;
  cash_drawer_session_no: string | null;
  cash_drawer_session_status: string | null;
}

export interface PosSessionListResult {
  items: PosSessionListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PosSessionSummaryAmountRow {
  currencyCode: string | null;
  amount: number;
  count: number;
}

export interface PosSessionSummaryGroupedAmountRow extends PosSessionSummaryAmountRow {
  groupCode: string | null;
  status: string | null;
}

export interface PosSessionVoucherLineSummaryRow extends PosSessionSummaryAmountRow {
  lineRole: string | null;
  paymentMethodCode: string | null;
  direction: string | null;
}

export interface PosSessionSummary {
  session: PosSessionRow;
  payments: {
    total: PosSessionSummaryAmountRow;
    byMethod: PosSessionSummaryGroupedAmountRow[];
  };
  refunds: {
    total: PosSessionSummaryAmountRow;
    byMethod: PosSessionSummaryGroupedAmountRow[];
  };
  voucherLines: {
    total: PosSessionSummaryAmountRow;
    byRole: PosSessionVoucherLineSummaryRow[];
  };
}
