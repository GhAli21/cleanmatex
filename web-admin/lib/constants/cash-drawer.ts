/**
 * Cash Ledger Foundation (CLF, ADR-057) — cash-drawer ledger constants.
 *
 * Every value mirrors a DB code exactly (CRITICAL RULE #12): catalogs seeded in
 * migrations 0523 (sys_cash_drawer_*), 0526 (voucher-line cash_effect_code) and
 * 0530 (line roles). Derive union types from these objects; never retype strings.
 */

import { CASH_DRAWER_SESSION_STATUSES, DRAWER_TYPES } from '@/lib/constants/payment';
import { LINE_ROLE } from '@/lib/constants/voucher';

export { CASH_DRAWER_SESSION_STATUSES, DRAWER_TYPES };
export type { CashDrawerSessionStatus, DrawerType } from '@/lib/constants/payment';

/** Drawer types a user may create from the drawer form; PENDING_DEPOSIT is system-provisioned. */
export const USER_CREATABLE_DRAWER_TYPES = [
  DRAWER_TYPES.COUNTER,
  DRAWER_TYPES.TEMPORARY,
  DRAWER_TYPES.DRIVER_BAG,
  DRAWER_TYPES.SAFE,
] as const;
export type UserCreatableDrawerType = (typeof USER_CREATABLE_DRAWER_TYPES)[number];

/**
 * Narrows a drawer type to one the drawer form may show.
 * @param type drawer type code from the DB
 * @returns true for every type except the system PENDING_DEPOSIT
 */
export function isUserCreatableDrawerType(type: string): type is UserCreatableDrawerType {
  return (USER_CREATABLE_DRAWER_TYPES as readonly string[]).includes(type);
}

/** Session statuses where the session is finished; the POS close guard allows only these. */
export const CASH_DRAWER_TERMINAL_SESSION_STATUSES = [
  CASH_DRAWER_SESSION_STATUSES.CLOSED,
  CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED,
] as const;

/** Custody transaction types — sys_cash_drawer_trx_type_cd (0523). */
export const CASH_DRAWER_TRX_TYPES = {
  FLOAT_ISSUE: 'FLOAT_ISSUE',
  CASH_DROP: 'CASH_DROP',
  DRAWER_TO_DRAWER: 'DRAWER_TO_DRAWER',
  DRIVER_HANDOVER: 'DRIVER_HANDOVER',
  DEPOSIT_PREP: 'DEPOSIT_PREP',
  /** System only — posted by the session finalize step. */
  CLOSE_DISPOSITION: 'CLOSE_DISPOSITION',
  /** System only — mirror of a reversed custody transaction. */
  REVERSAL: 'REVERSAL',
} as const;
export type CashDrawerTrxType = (typeof CASH_DRAWER_TRX_TYPES)[keyof typeof CASH_DRAWER_TRX_TYPES];

/** Count types — sys_cash_drawer_cnt_type_cd (0523). */
export const CASH_DRAWER_COUNT_TYPES = {
  OPENING: 'OPENING',
  SPOT: 'SPOT',
  CLOSING: 'CLOSING',
  RECOUNT: 'RECOUNT',
} as const;
export type CashDrawerCountType = (typeof CASH_DRAWER_COUNT_TYPES)[keyof typeof CASH_DRAWER_COUNT_TYPES];

/** Close disposition codes — sys_cash_drawer_ses_disp_cd (0523). */
export const CASH_DRAWER_DISPOSITIONS = {
  LEFT_IN_DRAWER: 'LEFT_IN_DRAWER',
  MOVED_TO_SAFE: 'MOVED_TO_SAFE',
  HANDED_TO_MANAGER: 'HANDED_TO_MANAGER',
  PREPARED_FOR_DEPOSIT: 'PREPARED_FOR_DEPOSIT',
  PARTIAL_REMOVED: 'PARTIAL_REMOVED',
  OTHER: 'OTHER',
  /** System only — backfill of sessions closed before CLF. */
  LEGACY: 'LEGACY',
} as const;
export type CashDrawerDisposition = (typeof CASH_DRAWER_DISPOSITIONS)[keyof typeof CASH_DRAWER_DISPOSITIONS];

/** How much cash a disposition moves — sys_cash_drawer_ses_disp_cd.cash_move_mode. */
export const CASH_DISPOSITION_MOVE_MODES = {
  NONE: 'NONE',
  ALL: 'ALL',
  PART: 'PART',
} as const;
export type CashDispositionMoveMode = (typeof CASH_DISPOSITION_MOVE_MODES)[keyof typeof CASH_DISPOSITION_MOVE_MODES];

/** After-close follow-up statuses — sys_cash_drawer_ses_post_cd (0523). */
export const CASH_DRAWER_POST_CLOSE_STATUSES = {
  IN_TRANSIT: 'IN_TRANSIT',
  DEPOSITED_TO_BANK: 'DEPOSITED_TO_BANK',
  HANDED_TO_HQ: 'HANDED_TO_HQ',
  OTHER: 'OTHER',
} as const;
export type CashDrawerPostCloseStatus =
  (typeof CASH_DRAWER_POST_CLOSE_STATUSES)[keyof typeof CASH_DRAWER_POST_CLOSE_STATUSES];

/**
 * Voucher-line cash effect — org_fin_voucher_trx_lines_dtl.cash_effect_code (0526).
 * NULL (no key here) = the line is not a cash-family line.
 */
export const CASH_EFFECTS = {
  /** Cash leg not completed yet — not in the drawer ledger until recognised. */
  PENDING: 'PENDING',
  /** In the drawer ledger (has drawer + ledger sequence + recognition time). */
  DRAWER: 'DRAWER',
  /** Cash-family method whose payment method is not drawer-tracked. */
  UNTRACKED: 'UNTRACKED',
  /** Pending leg that never completed. */
  NONE: 'NONE',
} as const;
export type CashEffect = (typeof CASH_EFFECTS)[keyof typeof CASH_EFFECTS];

/**
 * How the gate treats session state. INTERACTIVE = a person is handling cash at
 * the drawer now (refused without an open session when the policy requires one).
 * DEFERRED = a back-office or late event (verify, reversal) — never refused on
 * session state, lands in the next window when no session is open.
 */
export const CASH_GATE_MODES = {
  INTERACTIVE: 'INTERACTIVE',
  DEFERRED: 'DEFERRED',
} as const;
export type CashGateMode = (typeof CASH_GATE_MODES)[keyof typeof CASH_GATE_MODES];

/** Line roles offered by the drawer "Cash in / Cash out" dialog (§4B.2a-A). */
export const DRAWER_CASH_IN_OUT_ROLES = {
  OUT: [LINE_ROLE.EXPENSE_PAYMENT, LINE_ROLE.SUPPLIER_PAYMENT, LINE_ROLE.PETTY_CASH_ISSUE],
  IN: [LINE_ROLE.CASH_PAY_IN, LINE_ROLE.PETTY_CASH_RETURN],
} as const;

/** DB error SQLSTATEs raised by CLF triggers/functions (0523, 0526, 0527). */
export const CASH_LEDGER_SQLSTATES = {
  CURRENCY_NOT_CONFIGURED: 'CMX01',
  LINE_IMMUTABLE: 'CMX02',
  TRX_UNBALANCED: 'CMX03',
} as const;

/** Error codes returned by the cash-drawer ledger (plan §4B.11). */
export const CASH_LEDGER_ERRORS = {
  CASH_DRAWER_REQUIRED: 'CASH_DRAWER_REQUIRED',
  CASH_DRAWER_INACTIVE: 'CASH_DRAWER_INACTIVE',
  CASH_DRAWER_BRANCH_MISMATCH: 'CASH_DRAWER_BRANCH_MISMATCH',
  CASH_DRAWER_TYPE_NOT_ALLOWED: 'CASH_DRAWER_TYPE_NOT_ALLOWED',
  CASH_CURRENCY_REQUIRED: 'CASH_CURRENCY_REQUIRED',
  CASH_CURRENCY_MISMATCH: 'CASH_CURRENCY_MISMATCH',
  CASH_DRAWER_SESSION_NOT_OPEN: 'CASH_DRAWER_SESSION_NOT_OPEN',
  DRAWER_SESSION_CLOSING: 'DRAWER_SESSION_CLOSING',
  DRAWER_SESSION_NOT_CLOSING: 'DRAWER_SESSION_NOT_CLOSING',
  DRAWER_SESSION_WRONG_DRAWER: 'DRAWER_SESSION_WRONG_DRAWER',
  CASH_DISPOSITION_DEST_REQUIRED: 'CASH_DISPOSITION_DEST_REQUIRED',
  CASH_DISPOSITION_AMOUNT_INVALID: 'CASH_DISPOSITION_AMOUNT_INVALID',
  CASH_DISPOSITION_NOTES_REQUIRED: 'CASH_DISPOSITION_NOTES_REQUIRED',
  CASH_COUNT_REQUIRED: 'CASH_COUNT_REQUIRED',
  CASH_COUNT_TOTAL_MISMATCH: 'CASH_COUNT_TOTAL_MISMATCH',
  CASH_TRX_UNBALANCED: 'CASH_TRX_UNBALANCED',
  CASH_TRX_SAME_DRAWER: 'CASH_TRX_SAME_DRAWER',
  CASH_TRX_CROSS_BRANCH: 'CASH_TRX_CROSS_BRANCH',
  CASH_LINE_IMMUTABLE: 'CASH_LINE_IMMUTABLE',
  CASH_LEG_MUST_REVERSE: 'CASH_LEG_MUST_REVERSE',
  POST_CLOSE_SESSION_NOT_CLOSED: 'POST_CLOSE_SESSION_NOT_CLOSED',
  CASH_DRAWER_CURRENCY_NOT_CONFIGURED: 'CASH_DRAWER_CURRENCY_NOT_CONFIGURED',
} as const;
export type CashLedgerErrorCode = (typeof CASH_LEDGER_ERRORS)[keyof typeof CASH_LEDGER_ERRORS];
