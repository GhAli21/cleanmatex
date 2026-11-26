/**
 * The five kinds of time (MASTER_PLAN_v2 §1.1) as branded TypeScript types.
 * A brand is a compile-time tag only; values are plain `Date` objects and strings at runtime.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A moment, the same everywhere. Wire format: RFC 3339 UTC with `Z`. */
export type Instant = Brand<Date, 'Instant'>;
/** A wall-calendar day, `YYYY-MM-DD`. */
export type CivilDate = Brand<string, 'CivilDate'>;
/** A wall-clock time with no date, `HH:mm` or `HH:mm:ss`. */
export type LocalTime = Brand<string, 'LocalTime'>;
/** A wall date-time with no zone, `YYYY-MM-DDTHH:mm:ss` (the TS mirror of SQL `timestamp`). */
export type LocalDateTime = Brand<string, 'LocalDateTime'>;
/** An IANA zone id such as `Asia/Muscat` or `UTC` (D16, D32). */
export type ZoneId = Brand<string, 'ZoneId'>;

/** How a typed local time inside a DST gap or overlap becomes an instant (Temporal semantics). */
export type Disambiguation = 'compatible' | 'earlier' | 'later' | 'reject';
export const DISAMBIGUATIONS: readonly Disambiguation[] = ['compatible', 'earlier', 'later', 'reject'];

/** `Intl` hour cycle on the wire (`clock.hourCycle`). */
export type HourCycle = 'h12' | 'h23';
/** ISO weekday: Mon = 1 … Sun = 7 (`clock.weekStart`). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Alias used by the API contract. */
export type WeekStart = IsoWeekday;
/** Tenant numeric date pattern (`org_tenants_mst.date_format`, D34). */
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
export const DATE_FORMATS: readonly DateFormat[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];
/** Period grains of `dtPeriodKey` / `fn_cmx_dt_period_key`. */
export type PeriodGrain = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'FY';
/** Units of `dtCivilAdd` / `fn_cmx_dt_civil_add`. */
export type CivilUnit = 'DAY' | 'MONTH' | 'YEAR';

/** Structured local view of an instant (mirror of `fn_cmx_dt_local_parts`). */
export interface LocalParts {
  localDate: CivilDate;
  /** `HH:mm:ss` */
  localTime: LocalTime;
  isoDow: IsoWeekday;
  hour: number;
  minute: number;
  /** Offset from UTC in whole minutes at that instant (east positive). */
  utcOffsetMin: number;
}

/** Half-open UTC range `[start, end)`. */
export interface InstantRange {
  start: Instant;
  end: Instant;
}
