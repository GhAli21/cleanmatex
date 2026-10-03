import {
  POS_SESSION_AUTO_CLOSE_REASON,
  POS_SESSION_ROLLOVER_ERROR,
  POS_SESSION_SHARING_ERROR,
  POS_SESSION_STATUS,
} from '@/lib/constants/pos-session';

/** The session columns the lifecycle flags are derived from (all optional so list and detail rows both fit). */
export interface PosSessionFlagFacts {
  status: string;
  rollover_applied_at?: string | Date | null;
  stale_flagged_at?: string | Date | null;
  auto_close_reason?: string | null;
}

export interface PosSessionFlags {
  /** The rollover job acted on this session: the business day changed while it was live. */
  rolledOver: boolean;
  /** The session was flagged for staying live longer than the tenant's stale threshold. */
  stale: boolean;
  /** The system, not a person, closed it (rollover force-close). */
  autoClosed: boolean;
  /** Whether Resume is offered: only a paused session that was not rolled over. */
  canResume: boolean;
  /** Whether the session is live (open or paused). */
  isLive: boolean;
}

/**
 * Derives the presentation flags of a POS session. Pure — the single place the UI decides what a
 * rolled-over, stale or auto-closed session means, so the list, hub and detail agree.
 *
 * @param facts the session's status and lifecycle columns
 * @returns the derived flags
 * @example
 * getPosSessionFlags({ status: 'PAUSED', rollover_applied_at: '2026-10-04T00:15:00Z' }).canResume // false
 */
export function getPosSessionFlags(facts: PosSessionFlagFacts): PosSessionFlags {
  const isLive = facts.status === POS_SESSION_STATUS.OPEN || facts.status === POS_SESSION_STATUS.PAUSED;
  const rolledOver = Boolean(facts.rollover_applied_at);
  return {
    rolledOver,
    // Stale only matters while the session can still be acted on.
    stale: isLive && Boolean(facts.stale_flagged_at),
    autoClosed: facts.auto_close_reason === POS_SESSION_AUTO_CLOSE_REASON.ROLLOVER,
    canResume: facts.status === POS_SESSION_STATUS.PAUSED && !rolledOver,
    isLive,
  };
}

/**
 * Maps a business-day error code to its `posSessions.errors.*` i18n key, so the cashier reads the
 * rule in their own language instead of the server's English message.
 *
 * @param errorCode the `errorCode` of a failed POS-session call
 * @returns the key under `posSessions.errors`, or null when the code has no dedicated copy
 */
export function posSessionErrorKey(
  errorCode: string | null | undefined
): 'rolledOver' | 'timezoneNotConfigured' | 'drawerSessionExclusive' | null {
  if (errorCode === POS_SESSION_ROLLOVER_ERROR.ROLLED_OVER) return 'rolledOver';
  if (errorCode === POS_SESSION_ROLLOVER_ERROR.TENANT_TIMEZONE_NOT_CONFIGURED) return 'timezoneNotConfigured';
  if (errorCode === POS_SESSION_SHARING_ERROR.DRAWER_SESSION_EXCLUSIVE) return 'drawerSessionExclusive';
  return null;
}
