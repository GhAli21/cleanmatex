import { businessDateForTimezone } from '@/lib/utils/business-date';
import {
  civilDayBounds,
  formatInstant,
  formatInstantOrEmpty,
  formatStoredClock,
  formatStoredClockLabel,
  civilDateFromPickerDate,
  civilDatetimeLocalValue,
  instantFromDatetimeLocal,
  inclusiveEndOfCivilDay,
  civilYearEndDate,
  civilDateInputValue,
  civilDateInZone,
  civilYearInZone,
  prismaDateToCivil,
  civilTimeInZone,
  instantFromCivilDateTime,
  civilRangeQuery,
  formatCivilDate,
  shiftCivilDate,
  parseInstant,
  selectOperationalZone,
} from '@/lib/utils/operational-time';

const ACTIVE = new Set(['Asia/Muscat', 'Africa/Cairo', 'America/New_York']);

describe('selectOperationalZone', () => {
  it('uses the branch zone when that code is an active catalog zone', () => {
    expect(selectOperationalZone('Africa/Cairo', 'Asia/Muscat', ACTIVE)).toBe('Africa/Cairo');
  });

  it('uses the organization zone when the branch zone is empty or inactive', () => {
    expect(selectOperationalZone(null, 'Asia/Muscat', ACTIVE)).toBe('Asia/Muscat');
    expect(selectOperationalZone('Europe/London', 'Asia/Muscat', ACTIVE)).toBe('Asia/Muscat');
  });

  it('returns no zone when neither value is an active catalog zone', () => {
    expect(selectOperationalZone(null, null, ACTIVE)).toBeNull();
    expect(selectOperationalZone('Not/AZone', 'Also/Missing', ACTIVE)).toBeNull();
  });
});

describe('parseInstant', () => {
  it('accepts Z and a numeric offset', () => {
    expect(parseInstant('2026-10-03T21:00:00Z').toISOString()).toBe('2026-10-03T21:00:00.000Z');
    expect(parseInstant('2026-10-03T17:00:00-04:00').toISOString()).toBe('2026-10-03T21:00:00.000Z');
  });

  it('rejects a civil date and a wall time with no offset', () => {
    expect(() => parseInstant('2026-10-03')).toThrow(RangeError);
    expect(() => parseInstant('2026-10-03T21:00:00')).toThrow(RangeError);
  });
});

describe('civilDayBounds', () => {
  it('returns the Muscat civil day as a half-open UTC range', () => {
    const bounds = civilDayBounds('2026-10-04', 'Asia/Muscat');
    expect(bounds.start.toISOString()).toBe('2026-10-03T20:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-10-04T20:00:00.000Z');
    expect(businessDateForTimezone('Asia/Muscat', bounds.start)).toBe('2026-10-04');
    expect(businessDateForTimezone('Asia/Muscat', bounds.end)).toBe('2026-10-05');
  });

  it('uses the summer offset in New York and the winter offset in January', () => {
    expect(civilDayBounds('2026-07-15', 'America/New_York').start.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    expect(civilDayBounds('2026-01-15', 'America/New_York').start.toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
});

describe('formatInstant', () => {
  it('shows the Muscat clock for a UTC instant', () => {
    const label = formatInstant(new Date('2026-10-03T21:00:00Z'), 'Asia/Muscat', 'en');
    expect(label).toContain('2026');
    expect(label).toContain('01');
  });

  it('leaves the label empty when the zone is missing', () => {
    expect(formatInstantOrEmpty(new Date('2026-10-03T21:00:00Z'), null, 'en')).toBe('');
    expect(formatInstantOrEmpty(null, 'Asia/Muscat', 'en')).toBe('');
  });

  it('keeps a civil date and refuses a naive timestamp', () => {
    expect(formatStoredClock('2026-11-20', 'Asia/Muscat', 'en')).toBe('2026-11-20');
    expect(formatStoredClock('2026-11-20T10:00:00', 'Asia/Muscat', 'en')).toBe('');
    expect(formatStoredClock('2026-11-20T06:00:00Z', 'America/New_York', 'en')).toBe(
      formatInstant(new Date('2026-11-20T06:00:00Z'), 'America/New_York', 'en'),
    );
  });

  it('shifts a civil date by calendar days', () => {
    expect(shiftCivilDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftCivilDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('bounds a Muscat civil day for an inclusive query', () => {
    expect(civilRangeQuery('2026-10-04', '2026-10-04', 'Asia/Muscat')).toEqual({
      start: '2026-10-03T20:00:00.000Z',
      end: '2026-10-04T19:59:59.999Z',
    });
    expect(civilRangeQuery('2026-10-04', '2026-10-04', null)).toBeNull();
    expect(civilDateInZone('2026-10-03T21:00:00Z', 'Asia/Muscat')).toBe('2026-10-04');
    expect(civilDateInZone('2026-10-04', 'America/New_York')).toBe('2026-10-04');
    expect(formatCivilDate('2026-10-04', 'en')).toContain('2026');
  });

  it('turns a Muscat civil time into the matching instant', () => {
    expect(instantFromCivilDateTime('2026-10-04', '00:00', 'Asia/Muscat').toISOString()).toBe('2026-10-03T20:00:00.000Z');
    expect(civilTimeInZone('2026-10-03T20:00:00.000Z', 'Asia/Muscat')).toBe('00:00');
    expect(civilDateFromPickerDate(new Date(2026, 9, 4))).toBe('2026-10-04');
  });

  it('reads a Prisma date as a civil day and a fiscal year in the invoice zone', () => {
    expect(prismaDateToCivil(new Date('2026-10-04T00:00:00.000Z'))).toBe('2026-10-04');
    expect(civilYearInZone(new Date('2025-12-31T20:30:00.000Z'), 'Asia/Muscat')).toBe(2026);
    expect(civilYearInZone(new Date('2026-01-01T04:30:00.000Z'), 'America/New_York')).toBe(2025);
  });

  it('keeps a datetime-local value and a date-only expiry in the organization zone', () => {
    expect(civilDatetimeLocalValue('2026-10-03T20:00:00.000Z', 'Asia/Muscat')).toBe('2026-10-04T00:00');
    expect(civilDatetimeLocalValue('2026-10-03T20:00:00.000Z', null)).toBe('');
    expect(instantFromDatetimeLocal('2026-10-04T00:00', 'Asia/Muscat').toISOString()).toBe('2026-10-03T20:00:00.000Z');
    expect(inclusiveEndOfCivilDay('2026-12-31', 'Asia/Muscat').toISOString()).toBe('2026-12-31T19:59:59.999Z');
    expect(civilYearEndDate(new Date('2026-10-03T20:00:00.000Z'), 'Asia/Muscat')).toBe('2026-12-31');
    expect(civilYearEndDate(new Date('2026-10-03T20:00:00.000Z'), null)).toBe('');
    expect(civilDateInputValue('2026-12-31')).toBe('2026-12-31');
    expect(civilDateInputValue('2026-12-31T00:00:00.000Z')).toBe('2026-12-31');
    expect(civilDateInputValue(null)).toBe('');
  });

  it('labels a civil date without a zone and leaves an instant blank when the zone is missing', () => {
    expect(formatStoredClockLabel('2026-10-04', null, 'en')).toContain('2026');
    expect(formatStoredClockLabel('2026-10-03T20:00:00Z', null, 'en')).toBe('');
    expect(formatStoredClockLabel('2026-10-03T20:00:00Z', 'Asia/Muscat', 'en')).toContain('2026');
  });
});
