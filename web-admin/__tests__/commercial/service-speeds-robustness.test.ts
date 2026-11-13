/**
 * Service Speeds review WP1 (docs/features/Service_Speeds/REVIEW_2026-11-13.md B1–B7):
 * stored-data and input edge cases that must neither crash an order nor save a wrong day.
 */
import {
  resolveCalendar,
  resolveReadyBy,
  type BusinessHours,
  type ReadyByLineInput,
} from '@/lib/commercial';
import { parseBusinessHours, textToTimeColumn } from '@/lib/services/commercial/calendar-facts';
import { holidaySchema } from '@/lib/validations/business-calendar-schemas';
import { isRealIsoDate } from '@/lib/validations/iso-date';
import { speedRuleCreateSchema } from '@/lib/validations/speed-rule-schemas';

const DAY = { open: '08:00', close: '20:00' };
const GULF: BusinessHours = { sun: DAY, mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: null, sat: null };
const muscat = (date: string, time: string) => new Date(`${date}T${time}:00+04:00`);
const line = (over: Partial<ReadyByLineInput> = {}): ReadyByLineInput => ({
  lineId: 'L1', serviceSpeed: 'EXPRESS', speedRuleHours: null, productHours: null, categoryHours: null, extraMinutes: 0, ...over,
});
const calendar = (hours: BusinessHours = GULF) => resolveCalendar({
  branch: null,
  tenant: { timeZone: 'Asia/Muscat', businessHours: hours, cutoffTime: '11:00', readyTime: '18:00' },
  publicHolidayDates: [], tenantHolidays: [], branchHolidays: [],
});

describe('isRealIsoDate (B2)', () => {
  it.each(['2027-02-30', '2026-13-45', '2027-00-10', '1999-12-31', '2101-01-01', '2027-2-3', ''])('rejects %p', (v) => {
    expect(isRealIsoDate(v)).toBe(false);
  });
  it.each(['2027-02-28', '2028-02-29', '2026-12-31', '2000-01-01'])('accepts %p', (v) => {
    expect(isRealIsoDate(v)).toBe(true);
  });
});

describe('holiday schema (B1, B2)', () => {
  const base = { branchId: null, name: 'Day', isClosed: false, openTime: '10:00', closeTime: '14:00' };
  it('accepts a short day', () => {
    expect(holidaySchema.safeParse({ ...base, holidayDate: '2027-01-02' }).success).toBe(true);
  });
  it('refuses a 24:00 close: a TIME column would wrap it to 00:00', () => {
    expect(holidaySchema.safeParse({ ...base, holidayDate: '2027-01-02', closeTime: '24:00' }).success).toBe(false);
  });
  it('refuses a date that does not exist instead of saving another day', () => {
    expect(holidaySchema.safeParse({ ...base, holidayDate: '2027-02-30' }).success).toBe(false);
  });
  it('textToTimeColumn refuses 24:00 and malformed times', () => {
    expect(() => textToTimeColumn('24:00')).toThrow();
    expect(() => textToTimeColumn('9:5')).toThrow();
    expect(textToTimeColumn('23:59')?.toISOString()).toBe('1970-01-01T23:59:00.000Z');
    expect(textToTimeColumn(null)).toBeNull();
  });
});

describe('parseBusinessHours (B3, B4)', () => {
  it('reads 24:01 and other 24:xx as closed instead of letting the calendar throw', () => {
    const hours = parseBusinessHours({ ...GULF, mon: { open: '08:00', close: '24:30' } });
    expect(hours?.mon).toBeNull();
    expect(hours?.sun).toEqual(DAY);
    expect(() => resolveCalendar({
      branch: null,
      tenant: { timeZone: 'Asia/Muscat', businessHours: hours, cutoffTime: null, readyTime: null },
      publicHolidayDates: [], tenantHolidays: [], branchHolidays: [],
    })).not.toThrow();
  });
  it('keeps a 24:00 closing time', () => {
    expect(parseBusinessHours({ ...GULF, sun: { open: '08:00', close: '24:00' } })?.sun).toEqual({ open: '08:00', close: '24:00' });
  });
  it('reads an overnight day (close before open) as closed', () => {
    expect(parseBusinessHours({ ...GULF, sun: { open: '20:00', close: '02:00' } })?.sun).toBeNull();
  });
  it('a week with no open day is "not set", so a branch inherits the organization hours', () => {
    expect(parseBusinessHours({})).toBeNull();
    expect(parseBusinessHours({ sun: null, mon: null })).toBeNull();
    const branchHours = parseBusinessHours({ sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null });
    const cal = resolveCalendar({
      branch: { timeZone: null, businessHours: branchHours, cutoffTime: null, readyTime: null },
      tenant: { timeZone: 'Asia/Muscat', businessHours: GULF, cutoffTime: '11:00', readyTime: '18:00' },
      publicHolidayDates: [], tenantHolidays: [], branchHolidays: [],
    });
    expect(cal?.businessHours.sun).toEqual(DAY);
  });
});

describe('speed rule limits (B5)', () => {
  const rule = {
    serviceSpeed: 'EXPRESS', branchId: null, serviceCategoryCode: null, productId: null, effectiveFrom: '2026-11-01',
    speedPriceType: 'MULTIPLIER', multiplierSpeed: '0.25', turnaroundUnit: 'WORKING_DAYS',
  };
  it('caps working days at 60 and hours at 500', () => {
    expect(speedRuleCreateSchema.safeParse({ ...rule, turnaroundDaysSpeed: 60 }).success).toBe(true);
    expect(speedRuleCreateSchema.safeParse({ ...rule, turnaroundDaysSpeed: 61 }).success).toBe(false);
    const hoursRule = { ...rule, turnaroundUnit: 'HOURS' };
    expect(speedRuleCreateSchema.safeParse({ ...hoursRule, turnaroundHhSpeed: '500' }).success).toBe(true);
    expect(speedRuleCreateSchema.safeParse({ ...hoursRule, turnaroundHhSpeed: '501' }).success).toBe(false);
  });
  it('a rule the calendar cannot reach falls back to clock hours and says so, instead of throwing', () => {
    // One 1-minute opening a week: 3 hours of work needs ~180 weeks, far beyond the 400-day scan.
    const sparse = calendar({ sun: { open: '08:00', close: '08:01' } });
    const startAt = muscat('2026-11-08', '08:00');
    const result = resolveReadyBy({
      startAt, lines: [line({ speedRuleUnit: 'HOURS', speedRuleHours: '3' })], orderExtraMinutes: 0, orderOverride: null, calendar: sparse,
    });
    expect(result.orderReadyBy.toISOString()).toBe(new Date(startAt.getTime() + 3 * 3_600_000).toISOString());
    expect(result.notes).toContain('CALENDAR_UNRESOLVABLE');
  });
});

describe('turnaround fallbacks (B6, B7)', () => {
  const noCalendar = (l: ReadyByLineInput) => {
    const startAt = muscat('2026-11-08', '09:00');
    return (resolveReadyBy({ startAt, lines: [l], orderExtraMinutes: 0, orderOverride: null }).orderReadyBy.getTime() - startAt.getTime()) / 3_600_000;
  };
  it('a fast speed whose rule has no hours is never slower than STANDARD for the same item', () => {
    // Product 12 h, category 48 h: STANDARD takes 12 h, so the fast speed must not take 48 h.
    expect(noCalendar(line({ productHours: '12', categoryHours: '48' }))).toBe(12);
    // Product 36 h, category 24 h: the category's 24 h is already faster (PF-13).
    expect(noCalendar(line({ productHours: '36', categoryHours: '24' }))).toBe(24);
  });
  it('then the category hours, then the 12 h default (capped at STANDARD)', () => {
    expect(noCalendar(line({ categoryHours: '48' }))).toBe(48);
    expect(noCalendar(line())).toBe(12);
    expect(noCalendar(line({ productHours: '6' }))).toBe(6);
  });
  it('a speed ranked below STANDARD defaults to STANDARD hours, never faster', () => {
    expect(noCalendar(line({ serviceSpeed: 'ECONOMY', slowerThanStandard: true }))).toBe(24);
  });
  it('STANDARD is unchanged: product → category → 24 h', () => {
    expect(noCalendar(line({ serviceSpeed: 'STANDARD', productHours: '6', categoryHours: '48' }))).toBe(6);
    expect(noCalendar(line({ serviceSpeed: 'STANDARD' }))).toBe(24);
  });
});

describe('seeded ids (tester finding: branch 22222222-… answered 400)', () => {
  const DEMO_BRANCH = '22222222-2222-2222-2222-222222222222';
  it('a branch id that is not an RFC UUID (demo seeds) is accepted; garbage is not', () => {
    const base = { name: 'Day', isClosed: true, holidayDate: '2027-01-02' };
    expect(holidaySchema.safeParse({ ...base, branchId: DEMO_BRANCH }).success).toBe(true);
    expect(holidaySchema.safeParse({ ...base, branchId: 'not-an-id' }).success).toBe(false);
  });
});
