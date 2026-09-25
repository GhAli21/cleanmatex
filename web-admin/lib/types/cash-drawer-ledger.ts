/**
 * Cash Ledger Foundation (CLF, ADR-057) — types for the drawer ledger gate,
 * lock and window computations. Money is `Prisma.Decimal` inside services and
 * `string` at API boundaries; these types carry no money.
 */

import type {
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
