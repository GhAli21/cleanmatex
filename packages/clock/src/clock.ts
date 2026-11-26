import type { Instant } from './types.js';

/**
 * The injectable clock (MASTER_PLAN_v2 §6.2). Services receive a `Clock`; route handlers and
 * actions create one per request; tests use {@link fixedClock}. Nothing else asks the machine
 * for the time.
 */
export interface Clock {
  now(): Instant;
}

function asInstant(ms: number): Instant {
  return new Date(ms) as Instant;
}

/** The real clock. Use only at the request boundary. */
export const systemClock: Clock = Object.freeze({
  now: (): Instant => asInstant(Date.now()),
});

function toEpochMs(at: Date | string): number {
  const ms = typeof at === 'string' ? Date.parse(at) : at.getTime();
  if (Number.isNaN(ms)) throw new RangeError(`fixedClock: invalid instant ${String(at)}`);
  if (typeof at === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/.test(at)) {
    throw new RangeError('fixedClock: the instant needs Z or an offset');
  }
  return ms;
}

/** A clock frozen at one instant (tests, replays). */
export function fixedClock(at: Date | string): Clock {
  const ms = toEpochMs(at);
  return Object.freeze({ now: (): Instant => asInstant(ms) });
}

/** A clock shifted by `offsetMs` from another clock (tests that need a moving clock). */
export function offsetClock(base: Clock, offsetMs: number): Clock {
  return Object.freeze({ now: (): Instant => asInstant(base.now().getTime() + offsetMs) });
}

/**
 * A clock that answers the first value of `base` for its whole life: the TypeScript mirror of the
 * transaction time that `fn_cmx_dt_now()` returns. Create one per action.
 */
export function actionClock(base: Clock = systemClock): Clock {
  let captured: number | null = null;
  return Object.freeze({
    now: (): Instant => {
      if (captured === null) captured = base.now().getTime();
      return asInstant(captured);
    },
  });
}

/** Mirror of `fn_cmx_dt_now()`: the action instant. Pass an {@link actionClock} to keep it stable. */
export function dtNow(clock: Clock = systemClock): Instant {
  return asInstant(clock.now().getTime());
}

/** Mirror of `fn_cmx_dt_clock()`: the moving instant, for elapsed-time measurement. */
export function dtClock(clock: Clock = systemClock): Instant {
  return asInstant(clock.now().getTime());
}
