import {
  decideRollover,
  isSessionStale,
  openHours,
  ROLLOVER_ACTION,
} from '@/lib/services/pos-session-rollover-model';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';

const base = {
  businessDate: '2026-10-03',
  currentBusinessDate: '2026-10-04',
  rolloverAppliedAt: null,
  drawerStillOpen: false,
} as const;

describe('decideRollover', () => {
  it('does nothing when the mode is OFF', () => {
    expect(decideRollover({ ...base, mode: 'OFF', status: 'OPEN' })).toEqual({
      action: ROLLOVER_ACTION.NONE,
      blockedByDrawer: false,
    });
  });

  it('does nothing while the branch is still on the session business day', () => {
    expect(
      decideRollover({ ...base, mode: 'PAUSE_AT_ROLLOVER', status: 'OPEN', currentBusinessDate: '2026-10-03' }).action
    ).toBe(ROLLOVER_ACTION.NONE);
  });

  it('never acts on a session that already rolled over or is no longer live', () => {
    expect(
      decideRollover({ ...base, mode: 'PAUSE_AT_ROLLOVER', status: 'OPEN', rolloverAppliedAt: new Date() }).action
    ).toBe(ROLLOVER_ACTION.NONE);
    expect(decideRollover({ ...base, mode: 'PAUSE_AT_ROLLOVER', status: 'CLOSED' }).action).toBe(ROLLOVER_ACTION.NONE);
    expect(decideRollover({ ...base, mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'FORCE_CLOSED' }).action).toBe(
      ROLLOVER_ACTION.NONE
    );
  });

  it('pauses an open session and only stamps an already-paused one', () => {
    expect(decideRollover({ ...base, mode: 'PAUSE_AT_ROLLOVER', status: 'OPEN' }).action).toBe(ROLLOVER_ACTION.PAUSE);
    expect(decideRollover({ ...base, mode: 'PAUSE_AT_ROLLOVER', status: 'PAUSED' }).action).toBe(
      ROLLOVER_ACTION.MARK_ONLY
    );
  });

  it('force-closes when the drawer holds no cash', () => {
    expect(decideRollover({ ...base, mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'OPEN' })).toEqual({
      action: ROLLOVER_ACTION.FORCE_CLOSE,
      blockedByDrawer: false,
    });
    expect(decideRollover({ ...base, mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'PAUSED' }).action).toBe(
      ROLLOVER_ACTION.FORCE_CLOSE
    );
  });

  it('degrades a force-close to a pause while the linked drawer session is still open', () => {
    expect(
      decideRollover({ ...base, mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'OPEN', drawerStillOpen: true })
    ).toEqual({ action: ROLLOVER_ACTION.PAUSE, blockedByDrawer: true });
    expect(
      decideRollover({ ...base, mode: 'FORCE_CLOSE_AT_ROLLOVER', status: 'PAUSED', drawerStillOpen: true })
    ).toEqual({ action: ROLLOVER_ACTION.MARK_ONLY, blockedByDrawer: true });
  });
});

describe('isSessionStale / openHours', () => {
  const now = new Date('2026-10-03T20:00:00Z');
  const facts = {
    status: 'OPEN',
    openedAt: new Date('2026-10-03T07:00:00Z'),
    staleFlaggedAt: null,
    staleHours: 12,
    now,
  } as const;

  it('counts whole hours and never goes negative', () => {
    expect(openHours(new Date('2026-10-03T07:30:00Z'), now)).toBe(12);
    expect(openHours(new Date('2026-10-04T07:30:00Z'), now)).toBe(0);
  });

  it('flags a live session once it reaches the threshold', () => {
    expect(isSessionStale({ ...facts })).toBe(true);
    expect(isSessionStale({ ...facts, openedAt: new Date('2026-10-03T09:00:00Z') })).toBe(false);
  });

  it('flags paused sessions too, but only once', () => {
    expect(isSessionStale({ ...facts, status: 'PAUSED' })).toBe(true);
    expect(isSessionStale({ ...facts, staleFlaggedAt: new Date() })).toBe(false);
  });

  it('ignores closed sessions and a non-positive threshold', () => {
    expect(isSessionStale({ ...facts, status: 'CLOSED' })).toBe(false);
    expect(isSessionStale({ ...facts, staleHours: 0 })).toBe(false);
  });
});

describe('business date in a branch timezone', () => {
  it('uses the branch local date, not the UTC date', () => {
    const instant = new Date('2026-10-03T21:00:00Z');
    expect(businessDateForTimezone('Asia/Muscat', instant)).toBe('2026-10-04'); // UTC+4
    expect(businessDateForTimezone('America/New_York', instant)).toBe('2026-10-03'); // UTC-4
    expect(businessDateForTimezone('UTC', instant)).toBe('2026-10-03');
  });

  it('throws on a bad zone instead of silently falling back, and validates zones', () => {
    expect(() => businessDateForTimezone('Not/AZone')).toThrow(RangeError);
    expect(isValidTimeZone('Asia/Muscat')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
