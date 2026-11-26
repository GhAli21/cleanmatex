import type { Clock } from './clock.js';
import { ClockError } from './errors.js';
import { civilOf, timeOf, zonedAt } from './internal.js';
import { parseCivilDate } from './parse.js';
import { temporal } from './temporal.js';
import type { CivilDate, CivilUnit, IsoWeekday, LocalDateTime, LocalTime, PeriodGrain } from './types.js';

/** Mirror of `fn_cmx_dt_today_in(p_zone, p_at)`: the civil date of an instant in a zone. */
export function dtTodayIn(zone: string, at: Date): CivilDate {
  return civilOf(zonedAt(at, zone)) as CivilDate;
}

/** Mirror of `fn_cmx_dt_today`: today in the resolved zone. A missing zone raises `TIMEZONE_NOT_CONFIGURED`. */
export function dtToday(clock: Clock, zone: string | null | undefined): CivilDate {
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  return dtTodayIn(zone, clock.now());
}

/** Mirror of `fn_cmx_dt_today_or_null`: null when the zone is missing (health checks, labels). */
export function dtTodayOrNull(clock: Clock, zone: string | null | undefined): CivilDate | null {
  return zone ? dtTodayIn(zone, clock.now()) : null;
}

/** Mirror of `fn_cmx_dt_local_now`: the shop's wall date-time now. Display and cut-off checks only; never stored. */
export function dtLocalNow(clock: Clock, zone: string | null | undefined): LocalDateTime {
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  const z = zonedAt(clock.now(), zone);
  return `${civilOf(z)}T${timeOf(z)}` as LocalDateTime;
}

/** Mirror of `fn_cmx_dt_local_time`: the shop's wall time now, `HH:mm:ss`. */
export function dtLocalTime(clock: Clock, zone: string | null | undefined): LocalTime {
  if (!zone) throw new ClockError('TIMEZONE_NOT_CONFIGURED');
  return timeOf(zonedAt(clock.now(), zone)) as LocalTime;
}

/** Mirror of `fn_cmx_dt_civil_add`: `DAY`, `MONTH` (end-of-month clamp), `YEAR` (29 Feb clamps to 28 Feb). */
export function dtCivilAdd(date: string, n: number, unit: CivilUnit): CivilDate {
  if (!Number.isInteger(n)) throw new ClockError('CLOCK_SETTING_INVALID', { n });
  const pd = temporal().PlainDate.from(parseCivilDate(date));
  const duration =
    unit === 'DAY' ? { days: n } : unit === 'MONTH' ? { months: n } : unit === 'YEAR' ? { years: n } : null;
  if (!duration) throw new ClockError('CLOCK_SETTING_INVALID', { unit });
  return civilOf(pd.add(duration, { overflow: 'constrain' })) as CivilDate;
}

/** -1, 0 or 1 for two civil dates. */
export function compareCivil(a: string, b: string): -1 | 0 | 1 {
  const x = parseCivilDate(a);
  const y = parseCivilDate(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** ISO weekday (Mon = 1 … Sun = 7) of a civil date. */
export function isoWeekdayOf(date: string): IsoWeekday {
  return temporal().PlainDate.from(parseCivilDate(date)).dayOfWeek as IsoWeekday;
}

/** First day of the week that contains `date`, for a week starting on `weekStart`. */
export function weekStartDate(date: string, weekStart: IsoWeekday): CivilDate {
  if (!Number.isInteger(weekStart) || weekStart < 1 || weekStart > 7) {
    throw new ClockError('CLOCK_SETTING_INVALID', { weekStart });
  }
  const back = (isoWeekdayOf(date) - weekStart + 7) % 7;
  return dtCivilAdd(date, -back, 'DAY');
}

/** ISO 8601 week key `YYYY-Www` (Monday weeks). Reports only; doc-seq uses `dtPeriodKey(..., 'WEEK')`. */
export function isoWeekKey(date: string): string {
  const pd = temporal().PlainDate.from(parseCivilDate(date));
  const week = pd.weekOfYear ?? 0;
  const year = pd.yearOfWeek ?? pd.year;
  return `${String(year).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

export interface PeriodKeyOptions {
  /** Required for `WEEK`. */
  weekStart?: IsoWeekday;
  /** 1–12, required for `FY`. */
  fiscalYearStartMonth?: number;
}

/** Period key of a civil date (see {@link dtPeriodKey}). */
export function periodKeyOfDate(date: string, grain: PeriodGrain, opts: PeriodKeyOptions = {}): string {
  const d = parseCivilDate(date);
  const compact = d.replaceAll('-', '');
  switch (grain) {
    case 'DAY':
      return compact;
    case 'MONTH':
      return compact.slice(0, 6);
    case 'YEAR':
      return compact.slice(0, 4);
    case 'WEEK': {
      if (opts.weekStart === undefined) throw new ClockError('CLOCK_SETTING_INVALID', { grain, weekStart: null });
      return `W${weekStartDate(d, opts.weekStart).replaceAll('-', '')}`;
    }
    case 'FY': {
      const start = opts.fiscalYearStartMonth;
      if (start === undefined || !Number.isInteger(start) || start < 1 || start > 12) {
        throw new ClockError('CLOCK_SETTING_INVALID', { grain, fiscalYearStartMonth: start ?? null });
      }
      const year = Number(d.slice(0, 4));
      const month = Number(d.slice(5, 7));
      return `FY${String(month >= start ? year : year - 1).padStart(4, '0')}`;
    }
    default:
      throw new ClockError('CLOCK_SETTING_INVALID', { grain });
  }
}

/**
 * Mirror of `fn_cmx_dt_period_key`: `DAY` `YYYYMMDD`, `MONTH` `YYYYMM`, `YEAR` `YYYY`,
 * `WEEK` `W` + the civil date of the week's first day (`W20261121` for a Saturday-start week;
 * ISO `YYYY-Www` is not used because it is ambiguous for non-Monday weeks),
 * `FY` `FY` + the calendar year in which the fiscal year starts (start month 4: 2027-02-10 → `FY2026`).
 */
export function dtPeriodKey(instant: Date, zone: string, grain: PeriodGrain, opts: PeriodKeyOptions = {}): string {
  return periodKeyOfDate(dtTodayIn(zone, instant), grain, opts);
}
