import 'server-only';

import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { countingStart, openWindow, resolveReadyBy, toLocal, type BusinessHours } from '@/lib/commercial';
import { prisma } from '@/lib/db/prisma';
import {
  BRANCH_CALENDAR_SELECT,
  TENANT_CALENDAR_SELECT,
  loadResolvedCalendar,
  parseBusinessHours,
  textToTimeColumn,
  timeColumnToText,
} from '@/lib/services/commercial/calendar-facts';
import { businessDateForTimezone, isValidTimeZone } from '@/lib/utils/business-date';
import type {
  BranchCalendarInput,
  HolidayInput,
  OrganizationCalendarInput,
} from '@/lib/validations/business-calendar-schemas';

/**
 * Business Calendar settings (Service Speeds PLAN §5): the organization's and
 * each branch's opening hours, cut-off and ready time (typed columns, no
 * general settings), and the organization's own holidays (`org_holidays_cf`).
 * Every `org_*` query filters `tenant_org_id` (`org_tenants_mst` by its own id,
 * the tenant); a branch id from input is checked against the same tenant.
 * Ready-by reads these through `calendar-facts.ts`.
 */

/** A refused request; `status` is the HTTP status the route answers. */
export class BusinessCalendarError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_REFERENCE' | 'HOLIDAY_DUPLICATE' | 'CALENDAR_CHANGED',
    public readonly status: number,
  ) {
    super(code);
  }
}

/** HQ's starting calendar for the organization's country (or GENERIC), offered as "Fill from template". */
export interface CalendarTemplateView {
  code: string;
  name: string;
  name2: string | null;
  businessHours: BusinessHours | null;
  cutoffTime: string | null;
  readyTime: string | null;
}

/** The organization's calendar as the screen shows it. */
export interface OrganizationCalendarView {
  timezone: string | null;
  country: string | null;
  calendarTemplateCode: string | null;
  businessHours: BusinessHours | null;
  cutoffTime: string | null;
  readyTime: string | null;
  /** Identifies these three values; send it back on save so a concurrent change is refused, not overwritten. */
  version: string;
  /** Only on the organization's own read (null inside a branch view). */
  template: CalendarTemplateView | null;
}

/** A branch's own values (null = the organization's) and the organization's, for "Use organization's". */
export interface BranchCalendarView {
  branchId: string;
  branchName: string | null;
  branchName2: string | null;
  timezone: string | null;
  businessHours: BusinessHours | null;
  cutoffTime: string | null;
  readyTime: string | null;
  /** See `OrganizationCalendarView.version`. */
  version: string;
  organization: OrganizationCalendarView;
}

/** One `org_holidays_cf` row. */
export interface HolidayView {
  id: string;
  branchId: string | null;
  holidayDate: string;
  name: string;
  name2: string | null;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

/** One `sys_public_holidays_cf` row for the organization's country. */
export interface PublicHolidayView {
  holidayDate: string;
  holidayCode: string;
  name: string;
  name2: string | null;
  /** Islamic dates stay estimated until HQ confirms them. */
  isEstimated: boolean;
}

const dateText = (d: Date) => d.toISOString().slice(0, 10);
const dateColumn = (d: string) => new Date(`${d}T00:00:00Z`);
const hoursJson = (h: BusinessHours) => h as unknown as Prisma.InputJsonValue;

/** A short fingerprint of the three calendar values, so a save can tell that someone else changed them. */
const calendarVersion = (hours: BusinessHours | null, cutoff: string | null, ready: string | null) =>
  createHash('sha1').update(JSON.stringify([hours, cutoff, ready])).digest('hex').slice(0, 16);

async function organizationRow(tenantId: string) {
  const row = await prisma.org_tenants_mst.findFirst({
    where: { id: tenantId },
    select: {
      timezone: true, country: true, calendar_template_code: true,
      business_hours: true, order_cutoff_time: true, ready_time: true, updated_at: true,
    },
  });
  if (!row) throw new BusinessCalendarError('NOT_FOUND', 404);
  return row;
}

function toOrganizationView(row: Awaited<ReturnType<typeof organizationRow>>, template: CalendarTemplateView | null = null): OrganizationCalendarView {
  const businessHours = parseBusinessHours(row.business_hours);
  const cutoffTime = timeColumnToText(row.order_cutoff_time);
  const readyTime = timeColumnToText(row.ready_time);
  return {
    timezone: row.timezone,
    country: row.country,
    calendarTemplateCode: row.calendar_template_code,
    businessHours,
    cutoffTime,
    readyTime,
    version: calendarVersion(businessHours, cutoffTime, readyTime),
    template,
  };
}

/**
 * The starting calendar HQ keeps for this organization: its own template, else its country's, else GENERIC.
 * `sys_calendar_templates_mst` is a global catalog (no tenant column).
 */
async function templateFor(row: { calendar_template_code: string | null; country: string | null }): Promise<CalendarTemplateView | null> {
  const country = row.country?.trim().toUpperCase() || null;
  const rows = await prisma.sys_calendar_templates_mst.findMany({
    where: { is_active: true, rec_status: 1 },
    select: { calendar_code: true, country_code: true, name: true, name2: true, business_hours: true, order_cutoff_time: true, ready_time: true },
  });
  const t = rows.find((r) => r.calendar_code === row.calendar_template_code)
    ?? (country ? rows.find((r) => r.country_code === country) : undefined)
    ?? rows.find((r) => r.calendar_code === 'GENERIC');
  if (!t) return null;
  return {
    code: t.calendar_code,
    name: t.name,
    name2: t.name2,
    businessHours: parseBusinessHours(t.business_hours),
    cutoffTime: timeColumnToText(t.order_cutoff_time),
    readyTime: timeColumnToText(t.ready_time),
  };
}

/**
 * The organization's calendar.
 * @param tenantId - session tenant
 * @throws BusinessCalendarError NOT_FOUND
 */
export async function getOrganizationCalendar(tenantId: string): Promise<OrganizationCalendarView> {
  const row = await organizationRow(tenantId);
  return toOrganizationView(row, await templateFor(row));
}

/**
 * Replaces the organization's hours, cut-off and ready time.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param input - validated calendar
 * @example await updateOrganizationCalendar(tenantId, userId, { businessHours, cutoffTime: '11:00', readyTime: '18:00' })
 */
export async function updateOrganizationCalendar(
  tenantId: string,
  userId: string,
  input: OrganizationCalendarInput,
): Promise<OrganizationCalendarView> {
  const current = await organizationRow(tenantId);
  // Optimistic check: the screen saves what it loaded; if the stored values differ, someone else changed them first.
  if (input.version && input.version !== toOrganizationView(current).version) throw new BusinessCalendarError('CALENDAR_CHANGED', 409);
  const updated = await prisma.org_tenants_mst.updateMany({
    // The timestamp makes the check atomic: a write between the read above and this update matches no row.
    where: input.version ? { id: tenantId, updated_at: current.updated_at } : { id: tenantId },
    data: {
      business_hours: hoursJson(input.businessHours),
      order_cutoff_time: textToTimeColumn(input.cutoffTime),
      ready_time: textToTimeColumn(input.readyTime),
      updated_by: userId,
      updated_at: new Date(),
      updated_info: 'Business Calendar',
    },
  });
  if (updated.count === 0) throw new BusinessCalendarError(input.version ? 'CALENDAR_CHANGED' : 'NOT_FOUND', input.version ? 409 : 404);
  return getOrganizationCalendar(tenantId);
}

/**
 * A branch's calendar with the organization's values beside it.
 * @param tenantId - session tenant
 * @param branchId - branch id
 * @throws BusinessCalendarError NOT_FOUND (also for a branch of another organization)
 */
export async function getBranchCalendar(tenantId: string, branchId: string): Promise<BranchCalendarView> {
  const [branch, organization] = await Promise.all([
    prisma.org_branches_mst.findFirst({
      where: { id: branchId, tenant_org_id: tenantId },
      select: { id: true, name: true, name2: true, timezone_code: true, business_hours: true, order_cutoff_time: true, ready_time: true, updated_at: true },
    }),
    organizationRow(tenantId),
  ]);
  if (!branch) throw new BusinessCalendarError('NOT_FOUND', 404);
  const businessHours = parseBusinessHours(branch.business_hours);
  const cutoffTime = timeColumnToText(branch.order_cutoff_time);
  const readyTime = timeColumnToText(branch.ready_time);
  return {
    branchId: branch.id,
    branchName: branch.name,
    branchName2: branch.name2,
    timezone: branch.timezone_code,
    businessHours,
    cutoffTime,
    readyTime,
    version: calendarVersion(businessHours, cutoffTime, readyTime),
    organization: toOrganizationView(organization),
  };
}

/**
 * Replaces a branch's own calendar values; null = use the organization's.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param branchId - branch id
 * @param input - validated values
 * @throws BusinessCalendarError NOT_FOUND
 */
export async function updateBranchCalendar(
  tenantId: string,
  userId: string,
  branchId: string,
  input: BranchCalendarInput,
): Promise<BranchCalendarView> {
  const current = await prisma.org_branches_mst.findFirst({
    where: { id: branchId, tenant_org_id: tenantId },
    select: { business_hours: true, order_cutoff_time: true, ready_time: true, updated_at: true },
  });
  if (!current) throw new BusinessCalendarError('NOT_FOUND', 404);
  const currentVersion = calendarVersion(parseBusinessHours(current.business_hours), timeColumnToText(current.order_cutoff_time), timeColumnToText(current.ready_time));
  if (input.version && input.version !== currentVersion) throw new BusinessCalendarError('CALENDAR_CHANGED', 409);
  const updated = await prisma.org_branches_mst.updateMany({
    where: input.version
      ? { id: branchId, tenant_org_id: tenantId, updated_at: current.updated_at }
      : { id: branchId, tenant_org_id: tenantId },
    data: {
      // SQL NULL = the organization's hours.
      business_hours: input.businessHours ? hoursJson(input.businessHours) : Prisma.DbNull,
      order_cutoff_time: textToTimeColumn(input.cutoffTime),
      ready_time: textToTimeColumn(input.readyTime),
      updated_by: userId,
      updated_at: new Date(),
      updated_info: 'Business Calendar',
    },
  });
  if (updated.count === 0) throw new BusinessCalendarError(input.version ? 'CALENDAR_CHANGED' : 'NOT_FOUND', input.version ? 409 : 404);
  return getBranchCalendar(tenantId, branchId);
}

const holidaySelect = {
  id: true, branch_id: true, holiday_date: true, name: true, name2: true, is_closed: true, open_time: true, close_time: true,
} as const;

function toHolidayView(r: Prisma.org_holidays_cfGetPayload<{ select: typeof holidaySelect }>): HolidayView {
  return {
    id: r.id,
    branchId: r.branch_id,
    holidayDate: dateText(r.holiday_date),
    name: r.name,
    name2: r.name2,
    isClosed: r.is_closed,
    openTime: timeColumnToText(r.open_time),
    closeTime: timeColumnToText(r.close_time),
  };
}

/**
 * The year's holidays: the organization's own rows and the public holidays of
 * its country (the branch's country when a branch is given).
 * @param tenantId - session tenant
 * @param q - year, and optionally a branch (its rows plus organization-wide rows)
 * @throws BusinessCalendarError NOT_FOUND for a branch of another organization
 */
export async function listHolidays(
  tenantId: string,
  q: { year: number; branchId?: string },
): Promise<{ holidays: HolidayView[]; publicHolidays: PublicHolidayView[]; country: string | null }> {
  const range = { gte: dateColumn(`${q.year}-01-01`), lte: dateColumn(`${q.year}-12-31`) };
  const [tenant, branch] = await Promise.all([
    prisma.org_tenants_mst.findFirst({ where: { id: tenantId }, select: { country: true } }),
    q.branchId
      ? prisma.org_branches_mst.findFirst({ where: { id: q.branchId, tenant_org_id: tenantId }, select: { country: true } })
      : null,
  ]);
  if (q.branchId && !branch) throw new BusinessCalendarError('NOT_FOUND', 404);
  const country = branch?.country || tenant?.country || null;
  const [own, pub] = await Promise.all([
    prisma.org_holidays_cf.findMany({
      where: {
        tenant_org_id: tenantId, holiday_date: range, is_active: true, rec_status: 1,
        ...(q.branchId ? { OR: [{ branch_id: null }, { branch_id: q.branchId }] } : {}),
      },
      select: holidaySelect,
      orderBy: [{ holiday_date: 'asc' }, { branch_id: { sort: 'asc', nulls: 'first' } }],
    }),
    country
      ? prisma.sys_public_holidays_cf.findMany({
        where: { country_code: country, holiday_date: range, is_active: true, rec_status: 1 },
        select: { holiday_date: true, holiday_code: true, name: true, name2: true, is_estimated: true },
        orderBy: { holiday_date: 'asc' },
      })
      : [],
  ]);
  return {
    holidays: own.map(toHolidayView),
    publicHolidays: pub.map((p) => ({
      holidayDate: dateText(p.holiday_date), holidayCode: p.holiday_code, name: p.name, name2: p.name2, isEstimated: p.is_estimated,
    })),
    country,
  };
}

/** The branch must be one of this organization's. */
async function checkBranch(tenantId: string, branchId: string | null) {
  if (!branchId) return;
  const branch = await prisma.org_branches_mst.findFirst({ where: { id: branchId, tenant_org_id: tenantId }, select: { id: true } });
  if (!branch) throw new BusinessCalendarError('INVALID_REFERENCE', 422);
}

/** Prevented before save; the unique index (`uq_org_hol_scope_date`) covers a race. */
async function checkDateFree(tenantId: string, input: HolidayInput, selfId: string | null) {
  const clash = await prisma.org_holidays_cf.findFirst({
    where: {
      tenant_org_id: tenantId, branch_id: input.branchId, holiday_date: dateColumn(input.holidayDate),
      ...(selfId ? { NOT: { id: selfId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new BusinessCalendarError('HOLIDAY_DUPLICATE', 409);
}

const duplicateToError = (e: unknown): never => {
  throw (e as { code?: string } | null)?.code === 'P2002' ? new BusinessCalendarError('HOLIDAY_DUPLICATE', 409) : e;
};

function holidayColumns(input: HolidayInput) {
  return {
    branch_id: input.branchId,
    holiday_date: dateColumn(input.holidayDate),
    name: input.name,
    name2: input.name2 ?? null,
    is_closed: input.isClosed,
    open_time: input.isClosed ? null : textToTimeColumn(input.openTime ?? null),
    close_time: input.isClosed ? null : textToTimeColumn(input.closeTime ?? null),
  };
}

/**
 * Adds a holiday (closed, or open with its hours).
 * @param tenantId - session tenant
 * @param userId - actor
 * @param input - validated holiday
 * @throws BusinessCalendarError INVALID_REFERENCE | HOLIDAY_DUPLICATE
 */
export async function createHoliday(tenantId: string, userId: string, input: HolidayInput): Promise<HolidayView> {
  await checkBranch(tenantId, input.branchId);
  await checkDateFree(tenantId, input, null);
  const row = await prisma.org_holidays_cf.create({
    data: { ...holidayColumns(input), tenant_org_id: tenantId, created_by: userId, created_info: 'Business Calendar' },
    select: holidaySelect,
  }).catch(duplicateToError);
  return toHolidayView(row);
}

/**
 * Replaces a holiday.
 * @param tenantId - session tenant
 * @param userId - actor
 * @param id - holiday id
 * @param input - the holiday as it should be
 * @throws BusinessCalendarError NOT_FOUND | INVALID_REFERENCE | HOLIDAY_DUPLICATE
 */
export async function updateHoliday(tenantId: string, userId: string, id: string, input: HolidayInput): Promise<HolidayView> {
  await checkBranch(tenantId, input.branchId);
  await checkDateFree(tenantId, input, id);
  const updated = await prisma.org_holidays_cf.updateMany({
    where: { id, tenant_org_id: tenantId },
    data: { ...holidayColumns(input), updated_by: userId, updated_at: new Date(), updated_info: 'Business Calendar' },
  }).catch(duplicateToError);
  if (updated.count === 0) throw new BusinessCalendarError('NOT_FOUND', 404);
  const row = await prisma.org_holidays_cf.findFirst({ where: { id, tenant_org_id: tenantId }, select: holidaySelect });
  if (!row) throw new BusinessCalendarError('NOT_FOUND', 404);
  return toHolidayView(row);
}

/**
 * Deletes a holiday. Nothing references a holiday, and the unique date index
 * would block adding the same date again after a soft delete, so it is removed.
 * @param tenantId - session tenant
 * @param id - holiday id
 * @throws BusinessCalendarError NOT_FOUND
 */
export async function deleteHoliday(tenantId: string, id: string): Promise<void> {
  const deleted = await prisma.org_holidays_cf.deleteMany({ where: { id, tenant_org_id: tenantId } });
  if (deleted.count === 0) throw new BusinessCalendarError('NOT_FOUND', 404);
}

/** One speed in the "order placed now" preview. */
export interface ReadyPreviewRow {
  speed: string;
  name: string;
  name2: string | null;
  /** SPEED_RULE = the speed's organization-wide rule; DEFAULT = nothing configured; EXAMPLE = Standard on a 24 hour item. */
  source: 'SPEED_RULE' | 'DEFAULT' | 'EXAMPLE';
  unit: 'HOURS' | 'WORKING_DAYS';
  /** Hours or working days, by `unit`. */
  amount: number;
  readyByAt: string;
}

/** What an order placed right now would be promised, from the saved calendar and speed rules. */
export interface ReadyPreview {
  /** False when there are no business hours or time zone: ready-by then counts clock hours. */
  configured: boolean;
  timezone: string | null;
  openNow: boolean;
  /** When counting starts for an order placed now (now, or the next opening / after the cut-off). */
  countingStartsAt: string | null;
  rows: ReadyPreviewRow[];
}

/**
 * "An order placed now": the promised ready time per speed for the saved calendar (the branch's when
 * given, else the organization's). Uses the same engine as the order loader, so what the screen says is
 * what a cashier gets. A speed uses its organization-wide (or this branch's) rule; STANDARD is an example
 * on a 24 hour item because its hours come from the product or category.
 * @param tenantId - session tenant
 * @param branchId - a branch of this organization, or null for the organization
 * @param now - the moment to simulate (tests)
 * @throws BusinessCalendarError NOT_FOUND (also for a branch of another organization)
 * @example await previewReadyTimes(tenantId, null)
 */
export async function previewReadyTimes(tenantId: string, branchId: string | null, now: Date = new Date()): Promise<ReadyPreview> {
  const [tenant, branch] = await Promise.all([
    prisma.org_tenants_mst.findFirst({ where: { id: tenantId }, select: TENANT_CALENDAR_SELECT }),
    branchId
      ? prisma.org_branches_mst.findFirst({ where: { id: branchId, tenant_org_id: tenantId }, select: BRANCH_CALENDAR_SELECT })
      : null,
  ]);
  if (!tenant || (branchId && !branch)) throw new BusinessCalendarError('NOT_FOUND', 404);
  const timezone = [branch?.timezone_code, tenant.timezone].find((tz) => isValidTimeZone(tz)) ?? null;
  const none: ReadyPreview = { configured: false, timezone, openNow: false, countingStartsAt: null, rows: [] };
  if (!timezone) return none;

  const today = businessDateForTimezone(timezone, now);
  const calendar = await loadResolvedCalendar(prisma, tenantId, tenant, branch ?? null, branchId, today);
  if (!calendar) return none;

  const day = new Date(`${today}T00:00:00Z`);
  const [speeds, rules] = await Promise.all([
    prisma.sys_service_speed_cd.findMany({
      where: { is_active: true, rec_status: 1 },
      select: { code: true, name: true, name2: true },
      orderBy: { display_order: 'asc' },
    }),
    prisma.org_speed_price_rules_cf.findMany({
      where: {
        tenant_org_id: tenantId, is_active: true, rec_status: 1, product_id: null, service_category_code: null,
        effective_from: { lte: day },
        AND: [
          { OR: [{ effective_to: null }, { effective_to: { gte: day } }] },
          { OR: [{ branch_id: null }, ...(branchId ? [{ branch_id: branchId }] : [])] },
        ],
      },
      select: { service_speed: true, branch_id: true, effective_from: true, turnaround_hh_speed: true, turnaround_unit: true, turnaround_days_speed: true, cutoff_time_speed: true },
    }),
  ]);
  // A branch rule beats an organization-wide one; the latest start date wins within a scope.
  const ruleOf = new Map<string, (typeof rules)[number]>();
  for (const r of rules) {
    const cur = ruleOf.get(r.service_speed);
    const better = !cur || (r.branch_id != null && cur.branch_id == null)
      || (!!r.branch_id === !!cur.branch_id && r.effective_from > cur.effective_from);
    if (better) ruleOf.set(r.service_speed, r);
  }

  const rows: ReadyPreviewRow[] = [];
  for (const speed of speeds) {
    const rule = ruleOf.get(speed.code);
    if (!rule && speed.code !== 'STANDARD') continue; // not offered by an organization-wide rule
    const days = rule?.turnaround_days_speed ?? null;
    const unit = rule?.turnaround_unit === 'WORKING_DAYS' && days != null ? 'WORKING_DAYS' : 'HOURS';
    const result = resolveReadyBy({
      startAt: now,
      lines: [{
        lineId: speed.code,
        serviceSpeed: speed.code,
        speedRuleHours: rule?.turnaround_hh_speed?.toString() ?? null,
        speedRuleUnit: rule ? unit : null,
        speedRuleDays: days,
        speedRuleCutoffTime: timeColumnToText(rule?.cutoff_time_speed),
        // STANDARD's hours come from the product or category: an example item of 24 hours.
        productHours: speed.code === 'STANDARD' ? '24' : null,
        categoryHours: null,
        extraMinutes: 0,
      }],
      orderExtraMinutes: 0,
      orderOverride: null,
      calendar,
    });
    const line = result.lines[0];
    rows.push({
      speed: speed.code,
      name: speed.name,
      name2: speed.name2,
      source: speed.code === 'STANDARD' ? 'EXAMPLE' : line.source === 'SPEED_RULE' ? 'SPEED_RULE' : 'DEFAULT',
      unit: line.unit,
      amount: line.unit === 'WORKING_DAYS' ? (line.days ?? 0) : line.hours,
      readyByAt: line.readyByAt.toISOString(),
    });
  }

  const local = toLocal(now, timezone);
  const window = openWindow(calendar, local.date);
  return {
    configured: true,
    timezone,
    openNow: !!window && local.minutes >= window.open && local.minutes < window.close,
    countingStartsAt: countingStart(calendar, now).toISOString(),
    rows,
  };
}
