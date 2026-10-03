/**
 * Session API client (feature-owned) — heartbeat / status.
 *
 * Talks to `POST /api/auth/session/activity`. The server decides everything; this only transports it.
 */

import type { SessionEndReason } from '@/lib/constants/auth-session'

/** Server snapshot of the caller's session, in seconds remaining (relative — immune to clock skew). */
export interface SessionSnapshot {
  /** Seconds until the idle timeout; null when the session has no idle timeout (e.g. remember-me). */
  idleRemainingSec: number | null
  /** Seconds until absolute expiry (never extended by activity). */
  absoluteRemainingSec: number
  /** Seconds before idle expiry at which the user is warned. */
  idleWarningSec: number
}

/** Outcome of a heartbeat/status call. Flat shape (web-admin strict:false breaks union narrowing). */
export interface SessionPingResult {
  /** true = session alive and `snapshot` is set; false = ended or unavailable. */
  active: boolean
  snapshot?: SessionSnapshot
  /** Set when the server reports the session ended (401 SESSION_ENDED). */
  ended?: boolean
  endReason?: SessionEndReason | null
  /** Set on 503/network failure: the state is UNKNOWN — callers must not treat it as ended. */
  unavailable?: boolean
}

interface ActivityEnvelope {
  data?: {
    idleRemainingSec: number | null
    absoluteRemainingSec: number
    idleWarningSec: number
  }
  code?: string
  reason?: SessionEndReason | null
}

/**
 * Heartbeat (`touch: true`) or read-only status check (`touch: false`).
 *
 * @param touch - true only after genuine user activity / an explicit "stay signed in"
 */
export async function pingSession(touch: boolean): Promise<SessionPingResult> {
  try {
    const res = await fetch('/api/auth/session/activity', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ touch }),
    })

    if (res.status === 401) {
      const body = (await res.json().catch(() => ({}))) as ActivityEnvelope
      return { active: false, ended: true, endReason: body.reason ?? null }
    }
    if (!res.ok) return { active: false, unavailable: true }

    const body = (await res.json()) as ActivityEnvelope
    if (!body.data) return { active: false, unavailable: true }
    return {
      active: true,
      snapshot: {
        idleRemainingSec: body.data.idleRemainingSec,
        absoluteRemainingSec: body.data.absoluteRemainingSec,
        idleWarningSec: body.data.idleWarningSec,
      },
    }
  } catch {
    // Network failure: unknown, not ended — never sign the user out because of a blip.
    return { active: false, unavailable: true }
  }
}
