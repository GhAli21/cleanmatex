import * as clock from '@cmx/clock';
import * as zc from '@cmx/clock/zod';

describe('operations (D27)', () => {
  it('lists notify in the TypeScript list', () => {
    expect(clock.OPERATIONAL_ZONE_OPERATIONS).toContain('notify');
    expect(clock.isOperationalZoneOperation('notify')).toBe(true);
  });
  it('sends every code, notify included, to the SQL door from 0842 on', () => {
    expect(clock.SQL_DOOR_OPERATIONS).toEqual(clock.OPERATIONAL_ZONE_OPERATIONS);
    expect(clock.isSqlDoorOperation('notify')).toBe(true);
    expect(clock.assertSqlDoorOperation('notify')).toBe('notify');
    expect(clock.assertSqlDoorOperation('delivery')).toBe('delivery');
    expect(() => clock.assertSqlDoorOperation('nope')).toThrow(expect.objectContaining({ code: 'CLOCK_UNKNOWN_OPERATION' }));
  });
});

describe('errors (§5.4)', () => {
  it('maps every code to an HTTP status and a message key or null', () => {
    for (const code of clock.CLOCK_ERROR_CODES) {
      const e = new clock.ClockError(code);
      expect(e.message).toBe(code);
      expect(typeof e.httpStatus).toBe('number');
      expect(clock.isClockError(e)).toBe(true);
    }
    expect(new clock.ClockError('ZONE_MISMATCH').httpStatus).toBe(409);
    expect(new clock.ClockError('CLOCK_UNKNOWN_OPERATION').messageKey).toBeNull();
  });
});

describe('missing zone fails closed', () => {
  const c = clock.fixedClock('2026-11-26T21:00:00.000Z');
  it('dtToday raises TIMEZONE_NOT_CONFIGURED', () => {
    expect(() => clock.dtToday(c, null)).toThrow(expect.objectContaining({ code: 'TIMEZONE_NOT_CONFIGURED' }));
    expect(clock.dtTodayOrNull(c, null)).toBeNull();
  });
  it('dtLocalNow and dtLocalTime', () => {
    expect(clock.dtLocalNow(c, 'Asia/Muscat')).toBe('2026-11-27T01:00:00');
    expect(clock.dtLocalTime(c, 'Asia/Muscat')).toBe('01:00:00');
    expect(() => clock.dtLocalTime(c, undefined)).toThrow(expect.objectContaining({ code: 'TIMEZONE_NOT_CONFIGURED' }));
  });
  it('an abbreviation is INVALID_TIME_ZONE, not a fallback', () => {
    expect(() => clock.dtToday(c, 'GST')).toThrow(expect.objectContaining({ code: 'INVALID_TIME_ZONE' }));
  });
});

describe('format (D12, D13)', () => {
  const at = new Date('2026-11-26T18:06:00.000Z');
  it('formats in the shop zone with the Gregorian calendar and Latin digits', () => {
    expect(clock.formatInstant(at, 'Asia/Muscat', 'en-GB', { style: 'time', hourCycle: 'h23' })).toBe('22:06');
    const ar = clock.formatInstant(at, 'Asia/Riyadh', 'ar-SA', { style: 'date' });
    expect(ar).toMatch(/2026/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });
  it('uses Arabic-Indic digits only when asked', () => {
    expect(clock.formatCivilDate('2026-11-26', 'ar', { dateFormat: 'DD/MM/YYYY', numberingSystem: 'arab' })).toBe('٢٦/١١/٢٠٢٦');
  });
  it('tenant numeric date formats (D34)', () => {
    expect(clock.formatCivilDate('2026-11-26', 'en', { dateFormat: 'MM/DD/YYYY' })).toBe('11/26/2026');
    expect(clock.formatCivilDate('2026-11-26', 'en', { dateFormat: 'YYYY-MM-DD' })).toBe('2026-11-26');
  });
  it('a civil date never shifts with a zone', () => {
    expect(clock.formatCivilDate('2026-11-26', 'en-US')).toMatch(/26/);
  });
  it('local time in the hour cycle', () => {
    expect(clock.formatLocalTime('18:00', 'en-US', { hourCycle: 'h12' })).toMatch(/06:00\s?PM/);
    expect(clock.formatLocalTime('18:00', 'en-US', { hourCycle: 'h23' })).toBe('18:00');
  });
  it('zone label uses the offset of the instant shown', () => {
    expect(clock.zoneLabel('Asia/Muscat', at)).toBe('Asia/Muscat (GMT+4)');
    expect(clock.zoneOffsetLabel('America/New_York', new Date('2026-07-01T12:00:00Z'))).toBe('GMT-4');
    expect(clock.zoneOffsetLabel('America/New_York', new Date('2026-12-01T12:00:00Z'))).toBe('GMT-5');
  });
  it('buildIntlOptions always carries zone, calendar and digits', () => {
    const o = clock.buildIntlOptions({ zone: 'Asia/Muscat' });
    expect(o).toMatchObject({ timeZone: 'Asia/Muscat', calendar: 'gregory', numberingSystem: 'latn' });
  });
});

describe('zod primitives', () => {
  it('accepts and rejects with clock codes', () => {
    expect(zc.zInstant.safeParse('2026-11-26T18:06:00Z').success).toBe(true);
    const bad = zc.zInstant.safeParse('2026-11-26T18:06:00');
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toBe('INSTANT_OFFSET_REQUIRED');
    expect(zc.zCivilDate.safeParse('2026-02-30').success).toBe(false);
    expect(zc.zLocalTime.safeParse('24:00').success).toBe(false);
    expect(zc.zZoneId.safeParse('EST').success).toBe(false);
    expect(zc.zZonedInput.safeParse({ date: '2026-11-27', time: '18:00', disambiguation: 'reject' }).success).toBe(true);
    expect(zc.zCivilRange.safeParse({ from: '2026-11-27', toExclusive: '2026-11-26' }).success).toBe(false);
  });
  it('validates a clock block', () => {
    const block = clock.buildClockBlock({
      clock: clock.fixedClock('2026-11-26T22:00:00.000Z'), zone: 'Asia/Muscat', cutover: '00:00',
      hourCycle: '24h', weekStart: 6, dateFormat: 'YYYY-MM-DD', tzdbVersion: null,
    });
    expect(zc.zClockBlock.parse(block)).toEqual(block);
    expect(clock.toPublicClockBlock(block)).toEqual({ zone: 'Asia/Muscat', serverNow: block.serverNow, hourCycle: 'h23', dateFormat: 'YYYY-MM-DD' });
  });
});

describe('misc civil helpers', () => {
  it('isoWeekKey and compareCivil', () => {
    expect(clock.isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(clock.compareCivil('2026-11-26', '2026-11-27')).toBe(-1);
    expect(clock.weekStartDate('2026-11-26', 6)).toBe('2026-11-21');
  });
  it('rejects a disambiguation outside the closed list', () => {
    expect(() => clock.dtAtLocal('2026-11-27', '18:00', 'Asia/Muscat', 'nearest' as any)).toThrow(
      expect.objectContaining({ code: 'CLOCK_SETTING_INVALID' }),
    );
  });
});
