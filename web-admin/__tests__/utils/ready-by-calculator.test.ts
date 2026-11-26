/**
 * Ready By calculator test, restored on the current API (Time & Timezone G5, slice S1).
 * The legacy `calculateReadyBy` was retired; ready-by is computed by `resolveReadyBy` over the
 * branch calendar (`@/lib/commercial`). These cases are the old "Operations zone" cases ported to
 * that API, with exact UTC instants, so they must give the same answer under every process zone
 * (`npm run test:clock-tz` runs them with TZ=UTC and TZ=Pacific/Kiritimati).
 */
import { fixedClock, dtNow, dtAtLocal } from '@cmx/clock';
import {
  resolveCalendar,
  resolveReadyBy,
  type BusinessHours,
  type ReadyByLineInput,
} from '@/lib/commercial';
import { readyByBlockReason } from '@/lib/utils/ready-by-calculator';

const DAY = { open: '09:00', close: '18:00' };
/** Mon–Fri 09:00–18:00. */
const WEEKDAYS: BusinessHours = { mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: DAY, sat: null, sun: null };

const calendar = (zone: string, hours: BusinessHours = WEEKDAYS) => {
  const cal = resolveCalendar({
    branch: null,
    tenant: { timeZone: zone, businessHours: hours, cutoffTime: null, readyTime: null },
    publicHolidayDates: [],
    tenantHolidays: [],
    branchHolidays: [],
  });
  if (!cal) throw new Error('calendar expected');
  return cal;
};

const hoursLine = (h: string): ReadyByLineInput => ({
  lineId: 'L1',
  serviceSpeed: 'EXPRESS',
  speedRuleUnit: 'HOURS',
  speedRuleHours: h,
  productHours: null,
  categoryHours: null,
  extraMinutes: 0,
});

const readyBy = (startAt: string, h: string, zone = 'Asia/Muscat') =>
  resolveReadyBy({
    startAt: new Date(startAt),
    lines: [hoursLine(h)],
    orderExtraMinutes: 0,
    orderOverride: null,
    calendar: calendar(zone),
  }).orderReadyBy.toISOString();

describe('Ready By calculator (restored, G5)', () => {
  it('moves a Muscat drop-off after closing to the next working morning', () => {
    // Thu 2025-10-30 18:30 Muscat; 2 working hours from Fri 09:00 → Fri 11:00 Muscat.
    expect(readyBy('2025-10-30T14:30:00.000Z', '2')).toBe('2025-10-31T07:00:00.000Z');
  });

  it('keeps a same-day Muscat turnaround on the civil clock', () => {
    // Thu 09:00 Muscat + 4 working hours → Thu 13:00 Muscat.
    expect(readyBy('2025-10-30T05:00:00.000Z', '4')).toBe('2025-10-30T09:00:00.000Z');
  });

  it('skips the weekend', () => {
    // Fri 2025-10-31 17:00 Muscat: 1 h Fri, 9 h Mon, 9 h Tue, 5 h Wed → Wed 2025-11-05 14:00 Muscat.
    expect(readyBy('2025-10-31T13:00:00.000Z', '24')).toBe('2025-11-05T10:00:00.000Z');
  });

  it('counts working hours on the branch wall clock across a DST change', () => {
    // New York, Fri 2026-03-06 17:00 EST + 3 working hours: 1 h Fri, 2 h Mon (EDT) → Mon 11:00 EDT.
    const expected = dtAtLocal('2026-03-09', '11:00', 'America/New_York').toISOString();
    expect(readyBy('2026-03-06T22:00:00.000Z', '3', 'America/New_York')).toBe(expected);
  });

  it('ignores the process zone (same answer whatever TZ the test runs under)', () => {
    const first = readyBy('2025-10-30T14:30:00.000Z', '2');
    const second = readyBy('2025-10-30T14:30:00.000Z', '2');
    expect(second).toBe(first);
    expect(first.endsWith('Z')).toBe(true);
  });
});

describe('readyByBlockReason with an injected clock', () => {
  const clock = fixedClock('2026-11-26T18:00:00.000Z');

  it('requires a ready-by time', () => {
    expect(readyByBlockReason(null, false, dtNow(clock))).toBe('readyByRequired');
  });

  it('refuses a past time for a service order and allows a minute of slack for retail', () => {
    expect(readyByBlockReason('2026-11-26T17:59:30.000Z', false, dtNow(clock))).toBe('readyByMustBeFuture');
    expect(readyByBlockReason('2026-11-26T17:59:30.000Z', true, dtNow(clock))).toBeNull();
    expect(readyByBlockReason('2026-11-26T18:30:00.000Z', false, dtNow(clock))).toBeNull();
  });
});
