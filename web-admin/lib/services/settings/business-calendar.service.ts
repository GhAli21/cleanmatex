import 'server-only';

import { Prisma } from '@prisma/client';

import type { BusinessHours } from '@/lib/commercial/calendar';
import { prisma } from '@/lib/db/prisma';
import {
  parseBusinessHours,
  textToTimeColumn,
  timeColumnToText,
} from '@/lib/services/commercial/calendar-facts';
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
    public readonly code: 'NOT_FOUND' | 'INVALID_REFERENCE' | 'HOLIDAY_DUPLICATE',
    public readonly status: number,
  ) {
    super(code);
  }
}

/** The organization's calendar as the screen shows it. */
export interface OrganizationCalendarView {
  timezone: string | null;
  country: string | null;
  calendarTemplateCode: string | null;
  businessHours: BusinessHours | null;
  cutoffTime: string | null;
  readyTime: string | null;
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

async function organizationRow(tenantId: string) {
  const row = await prisma.org_tenants_mst.findFirst({
    where: { id: tenantId },
    select: {
      timezone: true, country: true, calendar_template_code: true,
      business_hours: true, order_cutoff_time: true, ready_time: true,
    },
  });
  if (!row) throw new BusinessCalendarError('NOT_FOUND', 404);
  return row;
}

function toOrganizationView(row: Awaited<ReturnType<typeof organizationRow>>): OrganizationCalendarView {
  return {
    timezone: row.timezone,
    country: row.country,
    calendarTemplateCode: row.calendar_template_code,
    businessHours: parseBusinessHours(row.business_hours),
    cutoffTime: timeColumnToText(row.order_cutoff_time),
    readyTime: timeColumnToText(row.ready_time),
  };
}

/**
 * The organization's calendar.
 * @param tenantId - session tenant
 * @throws BusinessCalendarError NOT_FOUND
 */
export async function getOrganizationCalendar(tenantId: string): Promise<OrganizationCalendarView> {
  return toOrganizationView(await organizationRow(tenantId));
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
  const updated = await prisma.org_tenants_mst.updateMany({
    where: { id: tenantId },
    data: {
      business_hours: hoursJson(input.businessHours),
      order_cutoff_time: textToTimeColumn(input.cutoffTime),
      ready_time: textToTimeColumn(input.readyTime),
      updated_by: userId,
      updated_at: new Date(),
      updated_info: 'Business Calendar',
    },
  });
  if (updated.count === 0) throw new BusinessCalendarError('NOT_FOUND', 404);
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
      select: { id: true, name: true, name2: true, timezone_code: true, business_hours: true, order_cutoff_time: true, ready_time: true },
    }),
    organizationRow(tenantId),
  ]);
  if (!branch) throw new BusinessCalendarError('NOT_FOUND', 404);
  return {
    branchId: branch.id,
    branchName: branch.name,
    branchName2: branch.name2,
    timezone: branch.timezone_code,
    businessHours: parseBusinessHours(branch.business_hours),
    cutoffTime: timeColumnToText(branch.order_cutoff_time),
    readyTime: timeColumnToText(branch.ready_time),
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
  const updated = await prisma.org_branches_mst.updateMany({
    where: { id: branchId, tenant_org_id: tenantId },
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
  if (updated.count === 0) throw new BusinessCalendarError('NOT_FOUND', 404);
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
