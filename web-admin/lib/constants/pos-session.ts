export const POS_SESSION_STATUS = {
  OPEN: 'OPEN',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
  FORCE_CLOSED: 'FORCE_CLOSED',
} as const;

export type PosSessionStatus =
  (typeof POS_SESSION_STATUS)[keyof typeof POS_SESSION_STATUS];

export const POS_SESSION_EVENT_TYPE = {
  OPEN: 'OPEN',
  AUTO_OPEN: 'AUTO_OPEN',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  CLOSE: 'CLOSE',
  FORCE_CLOSE: 'FORCE_CLOSE',
  AUTO_LINK_DRAWER: 'AUTO_LINK_DRAWER',
  /** The rollover job paused the session because the branch business day changed (0558). */
  ROLLOVER_PAUSE: 'ROLLOVER_PAUSE',
  /** The rollover job force-closed the session because the branch business day changed (0558). */
  ROLLOVER_FORCE_CLOSE: 'ROLLOVER_FORCE_CLOSE',
  /** The session stayed live longer than `pos_session_stale_hours` (0558). */
  STALE_FLAGGED: 'STALE_FLAGGED',
} as const;

export type PosSessionEventType =
  (typeof POS_SESSION_EVENT_TYPE)[keyof typeof POS_SESSION_EVENT_TYPE];

export const POS_SESSION_PERMISSIONS = {
  VIEW: 'pos_session:view',
  VIEW_ALL: 'pos_session:view_all',
  OPEN: 'pos_session:open',
  PAUSE_RESUME: 'pos_session:pause_resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
} as const;

export const POS_SESSION_IDEMPOTENCY_RESOURCE = {
  ENSURE_ORDER_ENTRY: 'pos_session:ensure_order_entry',
  OPEN: 'pos_session:open',
  PAUSE: 'pos_session:pause',
  RESUME: 'pos_session:resume',
  CLOSE: 'pos_session:close',
  FORCE_CLOSE: 'pos_session:force_close',
  AUTO_LINK_DRAWER: 'pos_session:auto_link_drawer',
} as const;

/** Mirrors `chk_ops_auto_close_reason` on `org_pos_sessions_mst` (0558): why the system closed a session. */
export const POS_SESSION_AUTO_CLOSE_REASON = {
  ROLLOVER: 'ROLLOVER',
} as const;

export type PosSessionAutoCloseReason =
  (typeof POS_SESSION_AUTO_CLOSE_REASON)[keyof typeof POS_SESSION_AUTO_CLOSE_REASON];

/** Reason text the rollover job writes into `pause_reason` / `force_close_reason`. */
export const POS_SESSION_ROLLOVER_REASON = 'ROLLOVER';

/** Notification Hub event codes registered by migration 0558 (`sys_ntf_events_cd`). */
export const POS_SESSION_NOTIFICATION_EVENT = {
  STALE: 'pos_session.stale',
  ROLLED_OVER: 'pos_session.rolled_over',
} as const;

/** Error codes of the business-day rules (rollover + timezone), mapped to HTTP by the routes. */
export const POS_SESSION_ROLLOVER_ERROR = {
  /** A rolled-over session cannot be resumed; close it and open a new one. */
  ROLLED_OVER: 'POS_SESSION_ROLLED_OVER',
  /** Neither the branch nor the tenant has a valid timezone, so no business date can be computed. */
  TENANT_TIMEZONE_NOT_CONFIGURED: 'TENANT_TIMEZONE_NOT_CONFIGURED',
} as const;

/** Error codes of drawer-session sharing (E2-2): `shared_session_mode = EXCLUSIVE` allows one POS session per drawer session. */
export const POS_SESSION_SHARING_ERROR = {
  DRAWER_SESSION_EXCLUSIVE: 'DRAWER_SESSION_EXCLUSIVE',
} as const;

/**
 * What a finance write takes (B1): `CASH` includes a cash-family tender, `NON_CASH` only other
 * tenders, `NONE` no tender at all (e.g. a zero-value order — never needs a POS session).
 */
export type FinanceTenderScope = 'CASH' | 'NON_CASH' | 'NONE';

/**
 * The finance screens that can take or pay out money, each with its own POS-session policy.
 * The policy lives in `org_fin_cash_ctrl_stng_cf.pos_session_mode_*` (migration 0554); the
 * surface → setting mapping is `POS_SESSION_SURFACE_SETTING_FIELD` in `lib/constants/cash-control.ts`.
 */
export const POS_SESSION_SURFACE = {
  /** Creating or updating an order with a payment (the POS flow). */
  ORDER_ENTRY: 'ORDER_ENTRY',
  /** Collecting a later payment on an existing order. */
  LATER_COLLECTION: 'LATER_COLLECTION',
  /** Wallet top-up, advance and gift-card sales. */
  STORED_VALUE_SALE: 'STORED_VALUE_SALE',
  /** Processing a cash refund (cash leaves the drawer). */
  CASH_REFUND: 'CASH_REFUND',
  /** Posting a customer account receipt (Customers → receive payment / allocate). */
  CUSTOMER_RECEIPT: 'CUSTOMER_RECEIPT',
  /** Posting a manual finance voucher from the Finance → Vouchers screens. */
  MANUAL_VOUCHER: 'MANUAL_VOUCHER',
} as const;

export type PosSessionSurface = (typeof POS_SESSION_SURFACE)[keyof typeof POS_SESSION_SURFACE];

/** Mirrors the CHECK on every `pos_session_mode_*` column (migration 0554). */
export const POS_SESSION_REQUIREMENT_MODE = {
  /** A POS session is required whenever money is tendered. */
  REQUIRED: 'REQUIRED',
  /** Required only when the payment includes cash. */
  REQUIRED_FOR_CASH: 'REQUIRED_FOR_CASH',
  /** Never blocks; the actor's open session is linked when one exists. */
  OPTIONAL: 'OPTIONAL',
} as const;

export type PosSessionRequirementMode =
  (typeof POS_SESSION_REQUIREMENT_MODE)[keyof typeof POS_SESSION_REQUIREMENT_MODE];

/**
 * Whether a surface policy makes a POS session mandatory for this tender. Pure — the single
 * place the mode semantics are defined.
 */
export function isPosSessionRequired(
  mode: PosSessionRequirementMode,
  tenderScope: FinanceTenderScope
): boolean {
  if (tenderScope === 'NONE') return false;
  if (mode === POS_SESSION_REQUIREMENT_MODE.REQUIRED) return true;
  return mode === POS_SESSION_REQUIREMENT_MODE.REQUIRED_FOR_CASH && tenderScope === 'CASH';
}
