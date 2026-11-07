/**
 * Service Speeds S2 — business calendar ready-by and ECONOMY discounts
 * (docs/features/Service_Speeds/PLAN.md §5, §11).
 */
import {
  fromLocal,
  resolveCalendar,
  resolveReadyBy,
  resolveSpeedPricing,
  toLocal,
  type BusinessHours,
  type CalendarInput,
  type ReadyByLineInput,
  type SpeedRuleCandidate,
} from '@/lib/commercial';

const DAY = { open: '08:00', close: '20:00' };
/** Gulf week: Fri–Sat weekend. */
const GULF: BusinessHours = { sun: DAY, mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: null, sat: null };

const calendar = (over: Partial<CalendarInput> = {}, tz = 'Asia/Muscat', hours: BusinessHours = GULF) => {
  const cal = resolveCalendar({
    branch: null,
    tenant: { timeZone: tz, businessHours: hours, cutoffTime: '11:00', readyTime: '18:00' },
    publicHolidayDates: [],
    tenantHolidays: [],
    branchHolidays: [],
    ...over,
  });
  if (!cal) throw new Error('calendar expected');
  return cal;
};

const line = (over: Partial<ReadyByLineInput> = {}): ReadyByLineInput => ({
  lineId: 'L1', serviceSpeed: 'EXPRESS', speedRuleHours: null, productHours: null, categoryHours: null, extraMinutes: 0, ...over,
});
const days = (n: number, over: Partial<ReadyByLineInput> = {}) => line({ speedRuleUnit: 'WORKING_DAYS', speedRuleDays: n, ...over });
const hours = (h: string, over: Partial<ReadyByLineInput> = {}) => line({ speedRuleUnit: 'HOURS', speedRuleHours: h, ...over });

/** Muscat is UTC+4 (no DST); 2026-11-08 is a Sunday. */
const muscat = (date: string, time: string) => new Date(`${date}T${time}:00+04:00`);
const ready = (startAt: Date, l: ReadyByLineInput, cal = calendar()) =>
  resolveReadyBy({ startAt, lines: [l], orderExtraMinutes: 0, orderOverride: null, calendar: cal }).orderReadyBy;

describe('time zone helpers', () => {
  it('round-trips local time in a fixed and a DST zone', () => {
    expect(toLocal(muscat('2026-11-08', '09:30'), 'Asia/Muscat')).toEqual({ date: '2026-11-08', minutes: 570 });
    expect(fromLocal('2026-11-08', 570, 'Asia/Muscat').toISOString()).toBe('2026-11-08T05:30:00.000Z');
    // London: BST (UTC+1) before 2026-10-25 02:00, GMT after.
    expect(fromLocal('2026-10-24', 600, 'Europe/London').toISOString()).toBe('2026-10-24T09:00:00.000Z');
    expect(fromLocal('2026-10-26', 600, 'Europe/London').toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });
});

describe('resolveCalendar', () => {
  it('branch fields win over organization fields; null branch fields inherit', () => {
    const cal = calendar({ branch: { timeZone: null, businessHours: null, cutoffTime: '13:00', readyTime: null } });
    expect(cal.cutoffMinutes).toBe(780);
    expect(cal.readyMinutes).toBe(1080);
    expect(cal.timeZone).toBe('Asia/Muscat');
  });

  it('no business hours, no time zone or no open weekday = not configured', () => {
    const base: CalendarInput = {
      branch: null, tenant: { timeZone: 'Asia/Muscat', businessHours: null, cutoffTime: null, readyTime: null },
      publicHolidayDates: [], tenantHolidays: [], branchHolidays: [],
    };
    expect(resolveCalendar(base)).toBeNull();
    expect(resolveCalendar({ ...base, tenant: { ...base.tenant, businessHours: GULF, timeZone: null } })).toBeNull();
    expect(resolveCalendar({ ...base, tenant: { ...base.tenant, businessHours: { mon: null } } })).toBeNull();
  });
});

describe('ready-by on a calendar (Asia/Muscat, Fri–Sat weekend, cut-off 11:00, ready 18:00)', () => {
  it('0 working days before the cut-off: same day at the ready time', () => {
    expect(ready(muscat('2026-11-08', '09:00'), days(0)).toISOString()).toBe(muscat('2026-11-08', '18:00').toISOString());
  });

  it('after the cut-off: counting starts the next working day', () => {
    expect(ready(muscat('2026-11-08', '12:00'), days(0)).toISOString()).toBe(muscat('2026-11-09', '18:00').toISOString());
  });

  it('the speed rule cut-off wins over the calendar cut-off', () => {
    expect(ready(muscat('2026-11-08', '12:00'), days(0, { speedRuleCutoffTime: '14:00' })).toISOString())
      .toBe(muscat('2026-11-08', '18:00').toISOString());
  });

  it('Fri–Sat weekend is skipped (Thu after cut-off, 1 working day → Mon)', () => {
    expect(ready(muscat('2026-11-12', '12:00'), days(1)).toISOString()).toBe(muscat('2026-11-16', '18:00').toISOString());
  });

  it('a closed day (drop-off on Friday) counts from the next opening', () => {
    expect(ready(muscat('2026-11-13', '09:00'), days(0)).toISOString()).toBe(muscat('2026-11-15', '18:00').toISOString());
  });

  it('a public holiday is skipped', () => {
    const cal = calendar({ publicHolidayDates: ['2026-11-09'] });
    expect(ready(muscat('2026-11-08', '09:00'), days(1), cal).toISOString()).toBe(muscat('2026-11-10', '18:00').toISOString());
  });

  it('"we open that day" on a public holiday, with short hours capping the ready time', () => {
    const cal = calendar({
      publicHolidayDates: ['2026-11-09'],
      tenantHolidays: [{ date: '2026-11-09', isClosed: false, openTime: '10:00', closeTime: '14:00' }],
    });
    expect(ready(muscat('2026-11-08', '09:00'), days(1), cal).toISOString()).toBe(muscat('2026-11-09', '14:00').toISOString());
  });

  it('a branch closure wins over the organization row', () => {
    const cal = calendar({
      tenantHolidays: [{ date: '2026-11-09', isClosed: false, openTime: '08:00', closeTime: '12:00' }],
      branchHolidays: [{ date: '2026-11-09', isClosed: true, openTime: null, closeTime: null }],
    });
    expect(ready(muscat('2026-11-08', '09:00'), days(1), cal).toISOString()).toBe(muscat('2026-11-10', '18:00').toISOString());
  });

  it('working hours continue across closing into the next opening', () => {
    // 18:30 + 3 h: 1.5 h today until 20:00, 1.5 h from 08:00 next day.
    expect(ready(muscat('2026-11-08', '10:30'), hours('3')).toISOString()).toBe(muscat('2026-11-08', '13:30').toISOString());
    expect(ready(muscat('2026-11-08', '18:30'), hours('3', { speedRuleCutoffTime: '19:00' })).toISOString())
      .toBe(muscat('2026-11-09', '09:30').toISOString());
  });

  it('preference minutes are working minutes; 0 hours is ready at once', () => {
    expect(ready(muscat('2026-11-08', '19:30'), hours('0', { extraMinutes: 60, speedRuleCutoffTime: '20:00' })).toISOString())
      .toBe(muscat('2026-11-09', '08:30').toISOString());
    const startAt = muscat('2026-11-13', '09:00'); // Friday, closed
    expect(ready(startAt, line({ serviceSpeed: 'STANDARD', productHours: '0' })).toISOString()).toBe(startAt.toISOString());
  });

  it('the order is ready with its slowest line; result carries unit and days', () => {
    const result = resolveReadyBy({
      startAt: muscat('2026-11-08', '09:00'),
      lines: [days(0), days(2, { lineId: 'L2' })],
      orderExtraMinutes: 0, orderOverride: null, calendar: calendar(),
    });
    expect(result.lines.map((l) => [l.unit, l.days])).toEqual([['WORKING_DAYS', 0], ['WORKING_DAYS', 2]]);
    expect(result.orderReadyBy.toISOString()).toBe(muscat('2026-11-10', '18:00').toISOString());
    expect(result.notes).toEqual([]);
  });

  it('Asia/Riyadh (UTC+3) uses its own local clock', () => {
    const cal = calendar({}, 'Asia/Riyadh');
    expect(ready(new Date('2026-11-08T09:00:00+03:00'), days(0), cal).toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });

  it('a DST change (Europe/London 2026-10-25) keeps working hours in local time', () => {
    const everyDay: BusinessHours = { sun: DAY, mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: DAY, sat: DAY };
    const cal = resolveCalendar({
      branch: null, tenant: { timeZone: 'Europe/London', businessHours: everyDay, cutoffTime: null, readyTime: null },
      publicHolidayDates: [], tenantHolidays: [], branchHolidays: [],
    });
    // Sat 19:00 BST + 2 h: 1 h Saturday, then Sunday 08:00 GMT + 1 h.
    expect(ready(new Date('2026-10-24T18:00:00Z'), hours('2'), cal!).toISOString()).toBe('2026-10-25T09:00:00.000Z');
  });
});

describe('ready-by without a calendar', () => {
  it('falls back to clock hours (working days × 24) with a note', () => {
    const startAt = new Date('2026-11-08T05:00:00Z');
    const result = resolveReadyBy({ startAt, lines: [days(2)], orderExtraMinutes: 0, orderOverride: null, calendar: null });
    expect(result.orderReadyBy.toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(result.notes).toEqual(['CALENDAR_NOT_CONFIGURED']);
  });

  it('rejects fractional or negative working days', () => {
    const startAt = new Date('2026-11-08T05:00:00Z');
    expect(() => resolveReadyBy({ startAt, lines: [days(-1)], orderExtraMinutes: 0, orderOverride: null })).toThrow();
    expect(() => resolveReadyBy({ startAt, lines: [days(1.5)], orderExtraMinutes: 0, orderOverride: null })).toThrow();
  });
});

describe('speed pricing: ECONOMY discount and turnaround fields', () => {
  const rule = (over: Partial<SpeedRuleCandidate> = {}): SpeedRuleCandidate => ({
    id: 'r-1', serviceSpeed: 'ECONOMY', branchId: null, serviceCategoryCode: null, productId: null,
    speedPriceType: 'MULTIPLIER', defaultSpeedSellPrice: null, multiplierSpeed: '-0.10', speedExtraAmount: null,
    priceBasis: null, turnaroundHhSpeed: null, turnaroundUnit: 'WORKING_DAYS', turnaroundDaysSpeed: 5,
    cutoffTimeSpeed: '10:00', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true, ...over,
  });
  const price = (r: SpeedRuleCandidate, discountAllowed: boolean, quantity = 2, standard = '10') => resolveSpeedPricing({
    serviceSpeed: r.serviceSpeed, branchId: null, serviceCategoryCode: null, productId: null, businessDate: '2026-11-08',
    standardUnitPrice: standard, referenceUnitPrice: standard, quantity, rules: [r], discountAllowed,
  });

  it('ECONOMY −10%: negative premium lowers the price', () => {
    const result = price(rule(), true);
    expect(result.unitPrice.toString()).toBe('9');
    expect(result.premiumAmount.toString()).toBe('-2');
    expect(result.warnings).toEqual([]);
    expect([result.turnaroundUnit, result.turnaroundDays, result.cutoffTime]).toEqual(['WORKING_DAYS', 5, '10:00']);
  });

  it('a speed that may not discount holds a negative premium at 0 and says so', () => {
    const result = price(rule({ serviceSpeed: 'EXPRESS' }), false);
    expect(result.premiumAmount.toString()).toBe('0');
    expect(result.warnings).toEqual(['SPEED_DISCOUNT_NOT_ALLOWED']);
  });

  it('SELL_PRICE below the reference is a discount only when allowed', () => {
    const sell = rule({ speedPriceType: 'SELL_PRICE', multiplierSpeed: null, defaultSpeedSellPrice: '8' });
    expect(price(sell, true).unitPrice.toString()).toBe('8');
    const held = price({ ...sell, serviceSpeed: 'EXPRESS' }, false);
    expect(held.unitPrice.toString()).toBe('10');
    expect(held.warnings).toEqual(['SELL_PRICE_BELOW_STANDARD']);
  });

  it('a discount larger than the price stops at 0 (per unit and per line)', () => {
    const perUnit = price(rule({ speedPriceType: 'FIXED_AMOUNT', multiplierSpeed: null, speedExtraAmount: '-15' }), true);
    expect(perUnit.unitPrice.toString()).toBe('0');
    expect(perUnit.premiumAmount.toString()).toBe('-20');
    expect(perUnit.warnings).toEqual(['SPEED_DISCOUNT_EXCEEDS_PRICE']);

    const perLine = price(rule({ speedPriceType: 'FIXED_AMOUNT', multiplierSpeed: null, speedExtraAmount: '-25', priceBasis: 'PER_LINE' }), true);
    expect(perLine.premiumAmount.toString()).toBe('-20');
    expect(perLine.warnings).toEqual(['SPEED_DISCOUNT_EXCEEDS_PRICE']);
  });

  it('no rule for the speed = NO_RULE (the API refuses it as SPEED_NOT_OFFERED)', () => {
    expect(price(rule({ serviceSpeed: 'NEXT_DAY' }), false).outcome).toBe('RULE_APPLIED');
    const none = resolveSpeedPricing({
      serviceSpeed: 'URGENT', branchId: null, serviceCategoryCode: null, productId: null, businessDate: '2026-11-08',
      standardUnitPrice: '10', referenceUnitPrice: '10', quantity: 1, rules: [rule()],
    });
    expect(none.outcome).toBe('NO_RULE');
  });
});
