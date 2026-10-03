/**
 * Idle / absolute timeout state machine (pure — no React, no timers, no clock reads except what is passed in).
 *
 * The SERVER is authoritative; this only decides what the UI shows. It is driven by the server's
 * "seconds remaining" snapshot plus the local time elapsed since that snapshot was received, so a wrong
 * client clock (or timezone) cannot make the UI disagree with the server.
 */

import type { SessionSnapshot } from '../api/session-api'

/** Seconds before absolute expiry at which a (non-extendable) heads-up is shown. */
export const ABSOLUTE_HEADS_UP_SEC = 5 * 60

/** What the UI should be doing right now. */
export type SessionPhase =
  /** Nothing to show. */
  | 'ACTIVE'
  /** Idle timeout is near: show the "stay signed in?" dialog with a countdown. */
  | 'IDLE_WARNING'
  /** Idle time is up locally: confirm with the server, then sign out. */
  | 'IDLE_EXPIRED'
  /** Absolute lifetime is up locally: confirm with the server, then sign out. */
  | 'ABSOLUTE_EXPIRED'

/** A server snapshot stamped with the local time it was received. */
export interface SessionClock extends SessionSnapshot {
  receivedAtMs: number
}

/** Result of evaluating the clock at a point in time. */
export interface SessionPhaseResult {
  phase: SessionPhase
  /** Seconds until the idle timeout (null when the session has none). Never negative. */
  idleSecondsLeft: number | null
  /** Seconds until absolute expiry. Never negative. */
  absoluteSecondsLeft: number
  /** true once absolute expiry is within {@link ABSOLUTE_HEADS_UP_SEC} (and not yet expired). */
  absoluteHeadsUp: boolean
}

/**
 * Stamp a server snapshot with its arrival time.
 *
 * @param snapshot - Server-reported remaining seconds
 * @param nowMs - Current local time (ms)
 */
export function createClock(snapshot: SessionSnapshot, nowMs: number): SessionClock {
  return { ...snapshot, receivedAtMs: nowMs }
}

/**
 * Evaluate the clock.
 *
 * Priority: absolute expiry beats idle (it cannot be extended), expired beats warning.
 *
 * @param clock - Latest server snapshot with its arrival time
 * @param nowMs - Current local time (ms)
 */
export function evaluatePhase(clock: SessionClock, nowMs: number): SessionPhaseResult {
  const elapsedSec = Math.max(0, (nowMs - clock.receivedAtMs) / 1000)

  const absoluteSecondsLeft = Math.max(0, Math.ceil(clock.absoluteRemainingSec - elapsedSec))
  const idleSecondsLeft =
    clock.idleRemainingSec === null ? null : Math.max(0, Math.ceil(clock.idleRemainingSec - elapsedSec))

  if (absoluteSecondsLeft <= 0) {
    return { phase: 'ABSOLUTE_EXPIRED', idleSecondsLeft, absoluteSecondsLeft, absoluteHeadsUp: false }
  }

  const absoluteHeadsUp = absoluteSecondsLeft <= ABSOLUTE_HEADS_UP_SEC

  if (idleSecondsLeft !== null) {
    if (idleSecondsLeft <= 0) return { phase: 'IDLE_EXPIRED', idleSecondsLeft, absoluteSecondsLeft, absoluteHeadsUp }
    // A session whose idle window is shorter than the warning lead time warns immediately.
    if (idleSecondsLeft <= clock.idleWarningSec) {
      return { phase: 'IDLE_WARNING', idleSecondsLeft, absoluteSecondsLeft, absoluteHeadsUp }
    }
  }

  return { phase: 'ACTIVE', idleSecondsLeft, absoluteSecondsLeft, absoluteHeadsUp }
}

/** Minimum gap between two heartbeats (ms) — mirrors the server's own 15 s write throttle, with margin. */
export const HEARTBEAT_MIN_INTERVAL_MS = 60_000

/**
 * Should the client send a heartbeat now?
 *
 * Only after genuine activity, at most once per interval, and never while the idle warning is showing
 * (during the warning only the explicit "Stay signed in" button extends the session).
 *
 * @param p.lastActivityAtMs - Time of the latest genuine user activity (0 = none yet)
 * @param p.lastPingAtMs - Time of the last heartbeat sent (0 = none yet)
 * @param p.nowMs - Current local time (ms)
 * @param p.phase - Current phase
 */
export function shouldSendHeartbeat(p: {
  lastActivityAtMs: number
  lastPingAtMs: number
  nowMs: number
  phase: SessionPhase
}): boolean {
  if (p.phase !== 'ACTIVE') return false
  if (p.lastActivityAtMs <= p.lastPingAtMs) return false // nothing new since the last heartbeat
  return p.nowMs - p.lastPingAtMs >= HEARTBEAT_MIN_INTERVAL_MS
}
