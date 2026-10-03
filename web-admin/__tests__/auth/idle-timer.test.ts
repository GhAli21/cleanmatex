/**
 * Idle / absolute timeout state machine (pure).
 *
 * @jest-environment node
 */

import {
  ABSOLUTE_HEADS_UP_SEC,
  HEARTBEAT_MIN_INTERVAL_MS,
  createClock,
  evaluatePhase,
  shouldSendHeartbeat,
} from '@/src/features/auth-session/model/idle-timer'

const T0 = 1_000_000_000_000;
const snap = (over: Partial<{ idleRemainingSec: number | null; absoluteRemainingSec: number; idleWarningSec: number }> = {}) => ({
  idleRemainingSec: 1800,
  absoluteRemainingSec: 12 * 3600,
  idleWarningSec: 60,
  ...over,
})
const at = (clock: ReturnType<typeof createClock>, secondsLater: number) => evaluatePhase(clock, T0 + secondsLater * 1000)

describe('evaluatePhase — idle', () => {
  it('is ACTIVE while plenty of idle time remains', () => {
    const r = at(createClock(snap(), T0), 10)
    expect(r.phase).toBe('ACTIVE')
    expect(r.idleSecondsLeft).toBe(1790)
  })

  it('enters IDLE_WARNING exactly when remaining time reaches the warning lead time', () => {
    const c = createClock(snap(), T0)
    expect(at(c, 1739).phase).toBe('ACTIVE') // 61 s left
    expect(at(c, 1740).phase).toBe('IDLE_WARNING') // 60 s left
    expect(at(c, 1740).idleSecondsLeft).toBe(60)
    expect(at(c, 1799).idleSecondsLeft).toBe(1)
  })

  it('is IDLE_EXPIRED when the idle time is used up and never reports negative seconds', () => {
    const c = createClock(snap(), T0)
    const r = at(c, 1800)
    expect(r.phase).toBe('IDLE_EXPIRED')
    expect(r.idleSecondsLeft).toBe(0)
    expect(at(c, 99999).idleSecondsLeft).toBe(0)
  })

  it('a session without an idle timeout (remember-me) never idles out', () => {
    const c = createClock(snap({ idleRemainingSec: null }), T0)
    const r = at(c, 20 * 3600 - 1)
    expect(r.idleSecondsLeft).toBeNull()
    expect(r.phase).not.toBe('IDLE_WARNING')
    expect(r.phase).not.toBe('IDLE_EXPIRED')
  })

  it('warns immediately when the idle window is shorter than the warning lead time', () => {
    expect(at(createClock(snap({ idleRemainingSec: 30 }), T0), 0).phase).toBe('IDLE_WARNING')
  })

  it('a fresh server snapshot resets the countdown (stay signed in)', () => {
    const stale = createClock(snap(), T0)
    expect(at(stale, 1750).phase).toBe('IDLE_WARNING')
    const refreshed = createClock(snap(), T0 + 1750 * 1000) // server says 1800 s again
    expect(evaluatePhase(refreshed, T0 + 1751 * 1000).phase).toBe('ACTIVE')
  })
})

describe('evaluatePhase — absolute', () => {
  it('is ABSOLUTE_EXPIRED when the lifetime is used up, even if idle time remains', () => {
    const c = createClock(snap({ idleRemainingSec: 1800, absoluteRemainingSec: 100 }), T0)
    expect(at(c, 100).phase).toBe('ABSOLUTE_EXPIRED')
    expect(at(c, 100).absoluteHeadsUp).toBe(false)
  })

  it('raises the heads-up flag within the last 5 minutes but stays ACTIVE', () => {
    const c = createClock(snap({ absoluteRemainingSec: ABSOLUTE_HEADS_UP_SEC + 10 }), T0)
    expect(at(c, 9).absoluteHeadsUp).toBe(false)
    const r = at(c, 10)
    expect(r.absoluteHeadsUp).toBe(true)
    expect(r.phase).toBe('ACTIVE')
  })

  it('absolute expiry wins over an idle warning', () => {
    const c = createClock(snap({ idleRemainingSec: 30, absoluteRemainingSec: 20 }), T0)
    expect(at(c, 25).phase).toBe('ABSOLUTE_EXPIRED')
  })
})

describe('evaluatePhase — clock safety', () => {
  it('a local clock that moved backwards cannot extend the session', () => {
    const c = createClock(snap(), T0)
    const r = evaluatePhase(c, T0 - 3_600_000) // "now" is an hour BEFORE the snapshot
    expect(r.idleSecondsLeft).toBe(1800) // elapsed clamps to 0, never negative
  })
})

describe('shouldSendHeartbeat', () => {
  const base = { lastActivityAtMs: T0 + 5_000, lastPingAtMs: T0, nowMs: T0 + HEARTBEAT_MIN_INTERVAL_MS, phase: 'ACTIVE' as const }

  it('sends after genuine activity once the interval has elapsed', () => {
    expect(shouldSendHeartbeat(base)).toBe(true)
  })

  it('does not send without new activity since the last ping', () => {
    expect(shouldSendHeartbeat({ ...base, lastActivityAtMs: T0 })).toBe(false)
    expect(shouldSendHeartbeat({ ...base, lastActivityAtMs: 0 })).toBe(false)
  })

  it('does not send more often than once per interval', () => {
    expect(shouldSendHeartbeat({ ...base, nowMs: T0 + HEARTBEAT_MIN_INTERVAL_MS - 1 })).toBe(false)
  })

  it('never sends while the idle warning is showing or after expiry (only the explicit button extends)', () => {
    expect(shouldSendHeartbeat({ ...base, phase: 'IDLE_WARNING' })).toBe(false)
    expect(shouldSendHeartbeat({ ...base, phase: 'IDLE_EXPIRED' })).toBe(false)
    expect(shouldSendHeartbeat({ ...base, phase: 'ABSOLUTE_EXPIRED' })).toBe(false)
  })
})
