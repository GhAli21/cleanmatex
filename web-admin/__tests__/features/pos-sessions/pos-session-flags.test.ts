import { getPosSessionFlags, posSessionErrorKey } from '@features/pos-sessions/model/pos-session-flags';

describe('getPosSessionFlags', () => {
  it('treats a healthy open session as having no flags and no resume', () => {
    expect(getPosSessionFlags({ status: 'OPEN' })).toEqual({
      rolledOver: false,
      stale: false,
      autoClosed: false,
      canResume: false,
      isLive: true,
    });
  });

  it('offers Resume only for a paused session that was not rolled over', () => {
    expect(getPosSessionFlags({ status: 'PAUSED' }).canResume).toBe(true);
    expect(getPosSessionFlags({ status: 'PAUSED', rollover_applied_at: '2026-10-04T00:15:00Z' }).canResume).toBe(false);
    expect(getPosSessionFlags({ status: 'OPEN' }).canResume).toBe(false);
  });

  it('shows stale only while the session is live', () => {
    expect(getPosSessionFlags({ status: 'OPEN', stale_flagged_at: '2026-10-03T20:00:00Z' }).stale).toBe(true);
    expect(getPosSessionFlags({ status: 'CLOSED', stale_flagged_at: '2026-10-03T20:00:00Z' }).stale).toBe(false);
  });

  it('marks a system rollover close as auto-closed', () => {
    const flags = getPosSessionFlags({ status: 'FORCE_CLOSED', auto_close_reason: 'ROLLOVER', rollover_applied_at: new Date() });
    expect(flags.autoClosed).toBe(true);
    expect(flags.isLive).toBe(false);
    expect(flags.canResume).toBe(false);
  });
});

describe('posSessionErrorKey', () => {
  it('maps the business-day error codes to their copy keys and ignores everything else', () => {
    expect(posSessionErrorKey('POS_SESSION_ROLLED_OVER')).toBe('rolledOver');
    expect(posSessionErrorKey('TENANT_TIMEZONE_NOT_CONFIGURED')).toBe('timezoneNotConfigured');
    expect(posSessionErrorKey('POS_SESSION_DRAWER_STILL_OPEN')).toBeNull();
    expect(posSessionErrorKey(undefined)).toBeNull();
  });
});
