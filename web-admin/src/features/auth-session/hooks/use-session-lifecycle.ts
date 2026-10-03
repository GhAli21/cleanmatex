'use client'

/**
 * useSessionLifecycle — client side of the server-authoritative session lifecycle.
 *
 * The server decides when a session ends; this hook only
 *  - keeps a local countdown from the server's "seconds remaining" snapshot,
 *  - sends a heartbeat after GENUINE user input (never for background traffic) so the idle window is extended,
 *  - warns before the idle timeout and offers "stay signed in" (the only explicit way to extend during a warning),
 *  - confirms with the server before signing out locally (another tab may have extended the session),
 *  - shares activity / sign-out with the other tabs of this browser (BroadcastChannel),
 *  - re-checks the session when the tab becomes visible again (e.g. after the laptop slept).
 *
 * A network failure is never treated as "session ended" — only an explicit server answer ends it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { SessionEndReason } from '@/lib/constants/auth-session'
import { pingSession } from '../api/session-api'
import {
  createClock,
  evaluatePhase,
  shouldSendHeartbeat,
  type SessionClock,
  type SessionPhase,
} from '../model/idle-timer'
import { openSessionChannel, type SessionChannelHandle } from '../model/session-channel'

/** DOM events that count as genuine user activity (pointer MOVEMENT deliberately does not). */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Minimum gap between cross-tab ACTIVITY broadcasts (ms). */
const BROADCAST_MIN_INTERVAL_MS = 5_000
/** Delay before re-checking the server after another tab reported activity (ms). */
const CROSS_TAB_RESYNC_DELAY_MS = 2_000
/** Minimum gap between expiry confirmations with the server (ms) — avoids hammering on a flaky network. */
const CONFIRM_MIN_INTERVAL_MS = 5_000

/** Options for {@link useSessionLifecycle}. */
export interface UseSessionLifecycleOptions {
  /** false until the user is authenticated and the tenant context is ready. */
  enabled: boolean
  /** Called ONCE when the session has ended (server-confirmed, or another tab signed out). */
  onSessionEnded: (info: { reason: SessionEndReason | null; fromOtherTab: boolean }) => void
}

/** What the UI needs. */
export interface SessionLifecycleState {
  phase: SessionPhase
  /** Countdown for the warning dialog (null outside IDLE_WARNING). */
  warningSecondsLeft: number | null
  /** true in the last minutes before absolute expiry (non-extendable heads-up). */
  absoluteHeadsUp: boolean
  /** Explicit "stay signed in": extends the session, closes the warning. Returns false if it failed. */
  staySignedIn: () => Promise<boolean>
}

/**
 * @param options - Enable flag and end-of-session callback
 */
export function useSessionLifecycle({ enabled, onSessionEnded }: UseSessionLifecycleOptions): SessionLifecycleState {
  const pathname = usePathname()

  const [phase, setPhase] = useState<SessionPhase>('ACTIVE')
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null)
  const [absoluteHeadsUp, setAbsoluteHeadsUp] = useState(false)

  const clockRef = useRef<SessionClock | null>(null)
  const phaseRef = useRef<SessionPhase>('ACTIVE')
  const lastActivityRef = useRef(0)
  const lastPingRef = useRef(0)
  const lastBroadcastRef = useRef(0)
  const lastConfirmRef = useRef(0)
  const busyRef = useRef(false)
  const endedRef = useRef(false)
  const channelRef = useRef<SessionChannelHandle | null>(null)
  const onEndedRef = useRef(onSessionEnded)

  useEffect(() => {
    onEndedRef.current = onSessionEnded
  }, [onSessionEnded])

  /** End once, no matter how many paths notice it at the same time. */
  const end = useCallback((reason: SessionEndReason | null, fromOtherTab: boolean) => {
    if (endedRef.current) return
    endedRef.current = true
    onEndedRef.current({ reason, fromOtherTab })
  }, [])

  /** Apply a new server snapshot and re-evaluate immediately. */
  const applySnapshot = useCallback((snapshot: NonNullable<Awaited<ReturnType<typeof pingSession>>['snapshot']>) => {
    const now = Date.now()
    clockRef.current = createClock(snapshot, now)
    const result = evaluatePhase(clockRef.current, now)
    phaseRef.current = result.phase
    setPhase(result.phase)
    setWarningSecondsLeft(result.phase === 'IDLE_WARNING' ? result.idleSecondsLeft : null)
    setAbsoluteHeadsUp(result.absoluteHeadsUp)
  }, [])

  /** Ask the server for the truth (touch = real activity). Handles ended/unavailable uniformly. */
  const syncWithServer = useCallback(
    async (touch: boolean): Promise<boolean> => {
      if (busyRef.current || endedRef.current) return false
      busyRef.current = true
      try {
        const result = await pingSession(touch)
        if (result.ended) {
          end(result.endReason ?? null, false)
          return false
        }
        if (result.active && result.snapshot) {
          if (touch) lastPingRef.current = Date.now()
          applySnapshot(result.snapshot)
          return true
        }
        return false // unavailable: keep the current state, retry on the next tick/event
      } finally {
        busyRef.current = false
      }
    },
    [applySnapshot, end]
  )

  // ─── Initial sync + visibility re-check ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    void syncWithServer(false)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncWithServer(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, syncWithServer])

  // ─── Cross-tab channel ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    let resyncTimer: ReturnType<typeof setTimeout> | undefined

    const channel = openSessionChannel((message) => {
      if (message.type === 'LOGOUT') {
        end(null, true)
      } else if (message.type === 'ACTIVITY' && phaseRef.current !== 'IDLE_WARNING') {
        // Another tab saw real activity and extended the server session: refresh our view (read-only).
        clearTimeout(resyncTimer)
        resyncTimer = setTimeout(() => void syncWithServer(false), CROSS_TAB_RESYNC_DELAY_MS)
      }
    })
    channelRef.current = channel

    return () => {
      clearTimeout(resyncTimer)
      channel.close()
      channelRef.current = null
    }
  }, [enabled, end, syncWithServer])

  // ─── Genuine user activity ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const onActivity = () => {
      // During the warning only the explicit "Stay signed in" button extends the session.
      if (phaseRef.current !== 'ACTIVE') return
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastBroadcastRef.current >= BROADCAST_MIN_INTERVAL_MS) {
        lastBroadcastRef.current = now
        channelRef.current?.post({ type: 'ACTIVITY', at: now })
      }
    }

    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true })
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true })
    }
  }, [enabled])

  // Navigation is activity too (the user clicked a link / used the app).
  useEffect(() => {
    if (enabled && phaseRef.current === 'ACTIVE') lastActivityRef.current = Date.now()
  }, [enabled, pathname])

  // ─── 1 s ticker: phase, heartbeat, expiry confirmation ─────────────────────
  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      const clock = clockRef.current
      if (!clock || endedRef.current) return
      const now = Date.now()
      const result = evaluatePhase(clock, now)

      phaseRef.current = result.phase
      setPhase(result.phase)
      setWarningSecondsLeft(result.phase === 'IDLE_WARNING' ? result.idleSecondsLeft : null)
      setAbsoluteHeadsUp(result.absoluteHeadsUp)

      if (result.phase === 'IDLE_EXPIRED' || result.phase === 'ABSOLUTE_EXPIRED') {
        // Local clock says it is over: confirm with the server (it may have been extended elsewhere).
        if (now - lastConfirmRef.current >= CONFIRM_MIN_INTERVAL_MS) {
          lastConfirmRef.current = now
          // Ended -> `end` fires; still active -> a fresh snapshot replaces the stale clock; unavailable -> retry.
          void syncWithServer(false)
        }
        return
      }

      if (
        shouldSendHeartbeat({
          lastActivityAtMs: lastActivityRef.current,
          lastPingAtMs: lastPingRef.current,
          nowMs: now,
          phase: result.phase,
        })
      ) {
        void syncWithServer(true)
      }
    }

    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [enabled, syncWithServer])

  const staySignedIn = useCallback(async () => {
    const ok = await syncWithServer(true)
    if (ok) lastActivityRef.current = Date.now()
    return ok
  }, [syncWithServer])

  return { phase, warningSecondsLeft, absoluteHeadsUp, staySignedIn }
}
