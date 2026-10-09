/**
 * POS shift reports (D2): the live X-report and the frozen Z-report of one POS session.
 * `kind` and the error codes are mirrored by the API and the UI; the status values mirror
 * `chk_opszr_status` on `org_pos_shift_z_rpt_tr` (migration 0559).
 */

/** X = live, never stored; Z = frozen at close, stored once per POS session. */
export const POS_SHIFT_REPORT_KIND = {
  X: 'X',
  Z: 'Z',
} as const;

export type PosShiftReportKind = (typeof POS_SHIFT_REPORT_KIND)[keyof typeof POS_SHIFT_REPORT_KIND];

/** Layout version of the snapshot JSON. Version 2 adds ordersCreated. Older stored Z-reports stay version 1 and omit that field. */
export const POS_SHIFT_SNAPSHOT_VERSION = 2;

/** How a shift ended — mirrors `chk_opszr_status`. */
export const POS_SHIFT_Z_SESSION_STATUS = {
  CLOSED: 'CLOSED',
  FORCE_CLOSED: 'FORCE_CLOSED',
} as const;

export type PosShiftZSessionStatus =
  (typeof POS_SHIFT_Z_SESSION_STATUS)[keyof typeof POS_SHIFT_Z_SESSION_STATUS];

/** Prefix of the human report number: `Z-<POS session number>`. */
export const POS_SHIFT_Z_REPORT_NO_PREFIX = 'Z-';

export const POS_SHIFT_REPORT_ERROR = {
  /** No Z-report exists yet for the session (it is still live, or the tenant does not auto-generate). */
  Z_NOT_FOUND: 'Z_REPORT_NOT_FOUND',
  /** A Z-report can only be generated once the POS session has closed. */
  SESSION_NOT_FINISHED: 'Z_REPORT_SESSION_NOT_FINISHED',
} as const;
