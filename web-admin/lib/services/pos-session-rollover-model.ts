import {
  POS_SESSION_STATUS,
  type PosSessionStatus,
} from '@/lib/constants/pos-session';
import {
  CASH_CONTROL_ROLLOVER_MODE,
  type CashControlRolloverMode,
} from '@/lib/constants/cash-control';

/**
 * Pure business-day rules for the POS-session rollover job (B2). No I/O — the job feeds in facts
 * and applies the verdict, so every branch of the policy is unit-testable.
 */

/** What the rollover job does to one live session. */
export const ROLLOVER_ACTION = {
  /** Nothing to do (same business day, mode OFF, or already handled). */
  NONE: 'NONE',
  /** OPEN → PAUSED, and the session may no longer be resumed. */
  PAUSE: 'PAUSE',
  /** OPEN/PAUSED → FORCE_CLOSED by the system. */
  FORCE_CLOSE: 'FORCE_CLOSE',
  /** Already PAUSED: only stamp rollover so it can no longer be resumed. */
  MARK_ONLY: 'MARK_ONLY',
} as const;

export type RolloverAction = (typeof ROLLOVER_ACTION)[keyof typeof ROLLOVER_ACTION];

export interface RolloverFacts {
  mode: CashControlRolloverMode;
  status: PosSessionStatus;
  /** Business date the session was opened on (`YYYY-MM-DD`). */
  businessDate: string;
  /** Today's business date in the branch timezone (`YYYY-MM-DD`). */
  currentBusinessDate: string;
  rolloverAppliedAt: Date | string | null;
  /** True while the linked cash-drawer session still holds cash (not in a terminal status). */
  drawerStillOpen: boolean;
}

export interface RolloverVerdict {
  action: RolloverAction;
  /** FORCE_CLOSE was configured but a live drawer session forced a pause instead. */
  blockedByDrawer: boolean;
}

const NO_ACTION: RolloverVerdict = { action: ROLLOVER_ACTION.NONE, blockedByDrawer: false };

const isLive = (status: PosSessionStatus) =>
  status === POS_SESSION_STATUS.OPEN || status === POS_SESSION_STATUS.PAUSED;

/**
 * Decides what the rollover job does to a session.
 *
 * A session is never force-closed while its cash-drawer session still holds cash: cash custody
 * is its own invariant, so FORCE_CLOSE degrades to a pause and the verdict says why.
 *
 * @param facts the session and branch-day facts
 * @returns the action to apply and whether the drawer blocked a force-close
 * @example
 * decideRollover({ mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'OPEN', businessDate: '2026-10-03',
 *   currentBusinessDate: '2026-10-04', rolloverAppliedAt: null, drawerStillOpen: true });
 * // { action: 'PAUSE', blockedByDrawer: true }
 */
export function decideRollover(facts: RolloverFacts): RolloverVerdict {
  if (facts.mode === CASH_CONTROL_ROLLOVER_MODE.OFF) return NO_ACTION;
  if (!isLive(facts.status) || facts.rolloverAppliedAt) return NO_ACTION;
  // ISO dates compare correctly as strings.
  if (facts.currentBusinessDate <= facts.businessDate) return NO_ACTION;

  const pauseOrMark =
    facts.status === POS_SESSION_STATUS.OPEN ? ROLLOVER_ACTION.PAUSE : ROLLOVER_ACTION.MARK_ONLY;

  if (facts.mode === CASH_CONTROL_ROLLOVER_MODE.FORCE_CLOSE_AT_ROLLOVER) {
    return facts.drawerStillOpen
      ? { action: pauseOrMark, blockedByDrawer: true }
      : { action: ROLLOVER_ACTION.FORCE_CLOSE, blockedByDrawer: false };
  }
  return { action: pauseOrMark, blockedByDrawer: false };
}

export interface StaleFacts {
  status: PosSessionStatus;
  openedAt: Date | string;
  staleFlaggedAt: Date | string | null;
  /** `pos_session_stale_hours`; a non-positive value disables stale flagging. */
  staleHours: number;
  now: Date;
}

/** Whole hours a session has been live, rounded down, never negative. */
export function openHours(openedAt: Date | string, now: Date): number {
  const opened = new Date(openedAt).getTime();
  return Math.max(0, Math.floor((now.getTime() - opened) / 3_600_000));
}

/**
 * Whether a live session should be flagged stale now. Flagging happens once (`stale_flagged_at`
 * is set and never cleared), so a long-lived session notifies once, not on every sweep.
 *
 * @param facts status, open time, flag state, threshold and the sweep instant
 * @returns true when the session is live, not yet flagged and past the threshold
 */
export function isSessionStale(facts: StaleFacts): boolean {
  if (!isLive(facts.status) || facts.staleFlaggedAt) return false;
  if (!(facts.staleHours > 0)) return false;
  return openHours(facts.openedAt, facts.now) >= facts.staleHours;
}
