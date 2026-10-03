/**
 * Cash Ledger Foundation (CLF, ADR-057) — types for the drawer ledger gate,
 * lock and window computations. Money is `Prisma.Decimal` inside services and
 * `string` at API boundaries; these types carry no money.
 */

import type { Decimal } from '@prisma/client/runtime/library';
import type {
  CashDrawerDisposition,
  CashEffect,
  CashGateMode,
  CashLedgerErrorCode,
  CashDrawerSessionStatus,
  DrawerType,
} from '@/lib/constants/cash-drawer';

/** Drawer facts the gate policy needs; loaded under the drawer row lock. */
export interface DrawerProfile {
  id: string;
  tenantOrgId: string;
  branchId: string;
  drawerType: DrawerType;
  currencyCode: string;
  isActive: boolean;
  // Hard capabilities from sys_cash_drawer_type_cd — never overridable.
  acceptsCustomerCash: boolean;
  allowsCustomerCashOut: boolean;
}

/** The drawer's live (OPEN or CLOSING) session, if any. */
export interface DrawerLiveSession {
  id: string;
  status: CashDrawerSessionStatus;
}

/** One voucher line as the gate policy sees it. */
export interface CashLineIntent {
  direction: string | null;
  paymentMethodCode: string | null;
  // From the tenant's payment-method config; false = cash tracked outside drawers.
  requiresCashDrawer: boolean;
  // Payment lifecycle already resolved by the caller (COMPLETED set → true).
  isCompleted: boolean;
  // Line currency, falling back to the voucher header currency.
  currencyCode: string | null;
  // Voucher branch; null = unknown (no branch check possible).
  branchId: string | null;
}

/** Input to the pure gate decision. */
export interface CashLineDecisionInput {
  line: CashLineIntent;
  // null = no drawer could be resolved for the line.
  drawer: DrawerProfile | null;
  liveSession: DrawerLiveSession | null;
  // Resolved cash-control setting (settings chain → type default → constant).
  requiresSession: boolean;
  mode: CashGateMode;
  /** B3-1: who may operate the drawer; omitted = no assignment rule applies. */
  assignment?: DrawerAssignmentFacts;
}

/** Assignment facts for one drawer and the acting user (B3-1). */
export interface DrawerAssignmentFacts {
  /** Resolved `drawer_assignment_mode`: `OPEN` (any cashier) or `ASSIGNED_ONLY`. */
  mode: string;
  assignedUserId: string | null;
  actorUserId: string;
  /** Holds `cash_drawer:operate_any` (supervisor override). */
  actorCanOperateAny: boolean;
}

/**
 * Gate decision. Flat shape on purpose (web-admin `strict:false` breaks
 * discriminated-union narrowing): `error` set ⇒ reject; otherwise `effect`
 * (null = not a cash line) and `sessionId` (null = no session / next window).
 */
export interface CashLineDecision {
  effect: CashEffect | null;
  sessionId: string | null;
  error: CashLedgerErrorCode | null;
}

/**
 * One `org_cash_drawer_ses_bal_dtl` row — a session's money in one currency
 * (CLF M4, §4B.3.6). Money as `Prisma.Decimal` (service-internal shape); the
 * API/route boundary serializes to strings (A3-4 convention). Per-currency
 * count refs and disposition live here, not on the session header — see the
 * table's own migration comment and IMPLEMENTATION_PLAN.md §4B.2 (P12).
 */
export interface SessionBalanceRow {
  id: string;
  cashDrawerSessionId: string;
  currencyCode: string;
  openingExpected: Decimal;
  openingCounted: Decimal | null;
  openingVariance: Decimal | null;
  openingCountId: string | null;
  finIn: Decimal;
  finOut: Decimal;
  trxIn: Decimal;
  trxOut: Decimal;
  closingExpected: Decimal | null;
  closingCounted: Decimal | null;
  closingVariance: Decimal | null;
  closingBasis: Decimal | null;
  closingCountId: string | null;
  varianceThresholdSnap: Decimal | null;
  varianceToleranceSnap: Decimal | null;
  dispositionCode: CashDrawerDisposition | null;
  dispositionNotes: string | null;
  dispositionDestDrawerId: string | null;
  dispositionKeptAmount: Decimal | null;
  dispositionTrxId: string | null;
}
