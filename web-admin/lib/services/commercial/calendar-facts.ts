/**
 * Business calendar facts (Service Speeds PLAN §5): reads one branch's
 * opening hours, cut-off, ready time and holidays, and resolves them with the
 * pure `resolveCalendar`.
 *
 * Shared by the order loader (create, quote, Edit) and the Business Calendar
 * settings service, so both see the same calendar. Every `org_*` query filters
 * `tenant_org_id` (CRITICAL RULE #4); `sys_public_holidays_cf` is global.
 */
import 'server-only';

import type { PrismaClient } from '@prisma/client';
import {
  WEEKDAYS,
  addDays,
  resolveCalendar,
  type BusinessHours,
  type CalendarFields,
  type HolidayOverride,
  type ResolvedCalendar,
} from '@/lib/commercial';
import { isValidTimeZone } from '@/lib/utils/business-date';

/** The reads this module needs; a transaction client works too. */
export type CalendarDb = Pick<PrismaClient, 'org_holidays_cf' | 'sys_public_holidays_cf'>;

/** Holidays are read this many days ahead: the calendar engine's scan limit. */
export const CALENDAR_HOLIDAY_WINDOW_DAYS = 400;

/** `org_tenants_mst` columns the calendar needs (add to an existing select). */
export const TENANT_CALENDAR_SELECT = {
  timezone: true, country: true, business_hours: true, order_cutoff_time: true, ready_time: true,
} as const;

/** `org_branches_mst` columns the calendar needs (add to an existing select). */
export const BRANCH_CALENDAR_SELECT = {
  timezone_code: true, country: true, business_hours: true, order_cutoff_time: true, ready_time: true,
} as const;

/** A tenant row with `TENANT_CALENDAR_SELECT`. */
export interface TenantCalendarRow {
  timezone: string | null;
  country: string | null;
  business_hours: unknown;
  order_cutoff_time: Date | null;
  ready_time: Date | null;
}

/** A branch row with `BRANCH_CALENDAR_SELECT`. */
export interface BranchCalendarRow {
  timezone_code: string | null;
  country: string | null;
  business_hours: unknown;
  order_cutoff_time: Date | null;
  ready_time: Date | null;
}

/** `HH:MM`, or `24:00` as an end-of-day closing time (no other 24:xx). */
const HH_MM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * A Postgres TIME column (Prisma: a Date on 1970-01-01 UTC) as `HH:MM`.
 * @param value the column value
 * @returns `HH:MM`, or null
 */
export function timeColumnToText(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/**
 * `HH:MM` as a value for a Prisma TIME column.
 * @param value `HH:MM` (00:00–23:59), or null
 * @returns a Date on 1970-01-01 UTC, or null
 * @throws Error on `24:00` or a malformed value: a TIME column cannot hold it (it would wrap to 00:00)
 */
export function textToTimeColumn(value: string | null): Date | null {
  if (!value) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`Not a time of day for a TIME column: ${value}`);
  return new Date(`1970-01-01T${value}:00.000Z`);
}

/**
 * Reads a `business_hours` JSON value. The DB CHECK validates the keys only, so
 * a day whose value is not `{ open: 'HH:MM', close: 'HH:MM' }` with open < close
 * reads as closed. A week with no open day reads as not set, so the organization's
 * hours apply to a branch (instead of the whole calendar resolving to nothing).
 * @param value the JSON column
 * @returns the hours, or null when the column is empty or no day opens
 */
export function parseBusinessHours(value: unknown): BusinessHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const hours: BusinessHours = {};
  let anyOpen = false;
  for (const day of WEEKDAYS) {
    const d = raw[day] as { open?: unknown; close?: unknown } | null | undefined;
    const ok = d && typeof d.open === 'string' && typeof d.close === 'string'
      && HH_MM.test(d.open) && HH_MM.test(d.close) && d.open < d.close;
    hours[day] = ok ? { open: d.open as string, close: d.close as string } : null;
    anyOpen ||= Boolean(ok);
  }
  return anyOpen ? hours : null;
}

/**
 * Tenant or branch row → calendar fields.
 * @param row the row (tenant: `timezone`; branch: `timezone_code`)
 * @returns the fields `resolveCalendar` merges
 */
export function calendarFieldsOf(row: TenantCalendarRow | BranchCalendarRow): CalendarFields {
  return {
    // An unknown zone reads as unset, so the other level's zone applies (as for effective dates).
    timeZone: [('timezone_code' in row ? row.timezone_code : row.timezone)].find((tz) => isValidTimeZone(tz)) ?? null,
    businessHours: parseBusinessHours(row.business_hours),
    cutoffTime: timeColumnToText(row.order_cutoff_time),
    readyTime: timeColumnToText(row.ready_time),
  };
}

const dateText = (value: Date) => value.toISOString().slice(0, 10);

/**
 * Reads the holidays of one branch from `fromDate` for
 * `CALENDAR_HOLIDAY_WINDOW_DAYS` and resolves the calendar.
 * @param db the Prisma client or a transaction client
 * @param tenantOrgId the session tenant
 * @param tenant the tenant row (`TENANT_CALENDAR_SELECT`)
 * @param branch the branch row (`BRANCH_CALENDAR_SELECT`), or null
 * @param branchId the branch id, or null (organization-wide holidays only)
 * @param fromDate the first local date (`YYYY-MM-DD`) that matters
 * @returns the calendar, or null when hours or a time zone are missing (clock-hour fallback)
 */
export async function loadResolvedCalendar(
  db: CalendarDb,
  tenantOrgId: string,
  tenant: TenantCalendarRow,
  branch: BranchCalendarRow | null,
  branchId: string | null,
  fromDate: string,
): Promise<ResolvedCalendar | null> {
  const tenantFields = calendarFieldsOf(tenant);
  const branchFields = branch ? calendarFieldsOf(branch) : null;
  // No hours anywhere: no calendar, so no holiday read.
  if (!branchFields?.businessHours && !tenantFields.businessHours) return null;

  const window = { gte: new Date(`${fromDate}T00:00:00Z`), lte: new Date(`${addDays(fromDate, CALENDAR_HOLIDAY_WINDOW_DAYS)}T00:00:00Z`) };
  const country = branch?.country || tenant.country;
  const [publicRows, ownRows] = await Promise.all([
    country
      ? db.sys_public_holidays_cf.findMany({
        where: { country_code: country, holiday_date: window, is_active: true, rec_status: 1 },
        select: { holiday_date: true },
      })
      : [],
    db.org_holidays_cf.findMany({
      where: {
        tenant_org_id: tenantOrgId, holiday_date: window, is_active: true, rec_status: 1,
        OR: [{ branch_id: null }, ...(branchId ? [{ branch_id: branchId }] : [])],
      },
      select: { branch_id: true, holiday_date: true, is_closed: true, open_time: true, close_time: true },
    }),
  ]);

  const override = (r: (typeof ownRows)[number]): HolidayOverride => ({
    date: dateText(r.holiday_date),
    isClosed: r.is_closed,
    openTime: timeColumnToText(r.open_time),
    closeTime: timeColumnToText(r.close_time),
  });
  return resolveCalendar({
    branch: branchFields,
    tenant: tenantFields,
    publicHolidayDates: publicRows.map((r) => dateText(r.holiday_date)),
    tenantHolidays: ownRows.filter((r) => r.branch_id == null).map(override),
    branchHolidays: ownRows.filter((r) => r.branch_id != null).map(override),
  });
}
