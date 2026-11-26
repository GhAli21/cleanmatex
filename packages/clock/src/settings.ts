import { assertCutover } from './business-day.js';
import { ClockError } from './errors.js';
import type { DateFormat, HourCycle, IsoWeekday, LocalTime } from './types.js';
import { DATE_FORMATS } from './types.js';

/**
 * Settings resolution (D33, accepted 2026-11-27). The stored homes are the `0668` columns:
 * - hour cycle: `org_tenants_mst.time_format` (`24h`/`12h`, NULL inherits)
 *   → `sys_country_cd.default_hour_cycle` (`H12`/`H23`, CLDR, D29) → `hq_general_config.time_format`;
 * - week start: `org_tenants_mst.first_day_of_week` (0 = Sun … 6 = Sat)
 *   → `sys_country_cd.default_week_start` (same encoding) → `hq_general_config.first_day_of_week`;
 * - cut-over: `org_branches_mst.business_day_cutover` → `org_tenants_mst.business_day_cutover`
 *   → `hq_general_config.business_day_cutover`;
 * - date format: `org_tenants_mst.date_format` → `hq_general_config.date_format` (D34).
 * The platform values come from the database (API `clock` block or a server read). There is
 * no constant in this file: a missing platform value raises `CLOCK_SETTING_INVALID`.
 */

export type SettingSource = 'branch' | 'tenant' | 'country' | 'platform';

export interface Resolved<T> {
  value: T;
  source: SettingSource;
}

const isSet = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined && v !== ('' as unknown);

/** `24h` → `h23`, `12h` → `h12`; also accepts the country codes `H23`/`H12` and the wire values. */
export function toHourCycle(value: string): HourCycle {
  switch (value) {
    case '24h':
    case 'H23':
    case 'h23':
      return 'h23';
    case '12h':
    case 'H12':
    case 'h12':
      return 'h12';
    default:
      throw new ClockError('CLOCK_SETTING_INVALID', { hourCycle: value });
  }
}

/** Stored day-of-week `0..6` (Sun = 0) → ISO weekday `1..7` (Sun = 7). */
export function dowToIsoWeekday(dow: number): IsoWeekday {
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) throw new ClockError('CLOCK_SETTING_INVALID', { weekStart: dow });
  return (dow === 0 ? 7 : dow) as IsoWeekday;
}

/** ISO weekday `1..7` → stored `0..6`. */
export function isoWeekdayToDow(iso: number): number {
  if (!Number.isInteger(iso) || iso < 1 || iso > 7) throw new ClockError('CLOCK_SETTING_INVALID', { weekStart: iso });
  return iso === 7 ? 0 : iso;
}

export interface HourCycleInput {
  tenant: string | null | undefined;
  country: string | null | undefined;
  platform: string | null | undefined;
}

/** Mirror of `fn_cmx_dt_hour_cycle`. */
export function resolveHourCycle(input: HourCycleInput): Resolved<HourCycle> {
  if (isSet(input.tenant)) return { value: toHourCycle(input.tenant), source: 'tenant' };
  if (isSet(input.country)) return { value: toHourCycle(input.country), source: 'country' };
  if (isSet(input.platform)) return { value: toHourCycle(input.platform), source: 'platform' };
  throw new ClockError('CLOCK_SETTING_INVALID', { setting: 'hourCycle', reason: 'platform value missing' });
}

export interface WeekStartInput {
  tenant: number | null | undefined;
  country: number | null | undefined;
  platform: number | null | undefined;
}

/** Mirror of `fn_cmx_dt_week_start`; inputs use the stored `0..6` encoding, the result is ISO. */
export function resolveWeekStart(input: WeekStartInput): Resolved<IsoWeekday> {
  if (isSet(input.tenant)) return { value: dowToIsoWeekday(input.tenant), source: 'tenant' };
  if (isSet(input.country)) return { value: dowToIsoWeekday(input.country), source: 'country' };
  if (isSet(input.platform)) return { value: dowToIsoWeekday(input.platform), source: 'platform' };
  throw new ClockError('CLOCK_SETTING_INVALID', { setting: 'weekStart', reason: 'platform value missing' });
}

export interface CutoverInput {
  branch: string | null | undefined;
  tenant: string | null | undefined;
  platform: string | null | undefined;
}

/** Mirror of `fn_cmx_dt_cutover`. */
export function resolveCutover(input: CutoverInput): Resolved<LocalTime> {
  if (isSet(input.branch)) return { value: assertCutover(input.branch), source: 'branch' };
  if (isSet(input.tenant)) return { value: assertCutover(input.tenant), source: 'tenant' };
  if (isSet(input.platform)) return { value: assertCutover(input.platform), source: 'platform' };
  throw new ClockError('CLOCK_SETTING_INVALID', { setting: 'cutover', reason: 'platform value missing' });
}

export interface DateFormatInput {
  tenant: string | null | undefined;
  platform: string | null | undefined;
}

function toDateFormat(value: string): DateFormat {
  if (!(DATE_FORMATS as readonly string[]).includes(value)) {
    throw new ClockError('CLOCK_SETTING_INVALID', { dateFormat: value });
  }
  return value as DateFormat;
}

/** Mirror of `fn_cmx_dt_date_format` (D34). */
export function resolveDateFormat(input: DateFormatInput): Resolved<DateFormat> {
  if (isSet(input.tenant)) return { value: toDateFormat(input.tenant), source: 'tenant' };
  if (isSet(input.platform)) return { value: toDateFormat(input.platform), source: 'platform' };
  throw new ClockError('CLOCK_SETTING_INVALID', { setting: 'dateFormat', reason: 'platform value missing' });
}
