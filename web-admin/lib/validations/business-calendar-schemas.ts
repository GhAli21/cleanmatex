/**
 * Business Calendar requests (Service Speeds PLAN §5–§6). Mirrors the DB:
 * `business_hours` keys `sun`..`sat` (CHECK `chk_org_tnt_business_hours` /
 * `chk_org_brn_business_hours`), a day is `{ open, close }` with open < close
 * or null (closed); holidays follow `chk_org_hol_times` (closed ⇔ no times,
 * open day ⇔ open < close).
 */
import { z } from 'zod';

import { WEEKDAYS } from '@/lib/commercial/calendar';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
/** Closing may be 24:00 (open until midnight). */
const closing = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'HH:MM');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const dayHours = z.object({ open: hhmm, close: closing })
  .refine((d) => d.open < d.close, { message: 'Opens before it closes', path: ['close'] })
  .nullable();

/** One week: every day present; null = closed. At least one day must open. */
export const businessHoursSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, dayHours])) as Record<(typeof WEEKDAYS)[number], typeof dayHours>,
).refine((week) => Object.values(week).some((d) => d != null), { message: 'Open at least one day' });

/** PUT /settings/calendar: the organization's calendar. */
export const organizationCalendarSchema = z.object({
  businessHours: businessHoursSchema,
  /** Last drop-off counted today; null = no cut-off. */
  cutoffTime: hhmm.nullable(),
  /** Default ready time for working-day speeds; null = closing time. */
  readyTime: hhmm.nullable(),
});
export type OrganizationCalendarInput = z.infer<typeof organizationCalendarSchema>;

/** PUT /settings/branches/[id]/calendar: each field null = the organization's. */
export const branchCalendarSchema = z.object({
  businessHours: businessHoursSchema.nullable(),
  cutoffTime: hhmm.nullable(),
  readyTime: hhmm.nullable(),
});
export type BranchCalendarInput = z.infer<typeof branchCalendarSchema>;

/** POST /settings/holidays and PATCH /settings/holidays/[id] (full row). */
export const holidaySchema = z.object({
  /** Null = every branch. */
  branchId: z.string().uuid().nullable(),
  holidayDate: date,
  name: z.string().trim().min(1).max(200),
  name2: z.string().trim().max(200).nullable().optional(),
  /** False = open that day, with these hours (a short day, or open on a public holiday). */
  isClosed: z.boolean(),
  openTime: hhmm.nullable().optional(),
  closeTime: closing.nullable().optional(),
}).superRefine((v, ctx) => {
  const times = v.openTime != null || v.closeTime != null;
  if (v.isClosed && times) ctx.addIssue({ code: 'custom', path: ['openTime'], message: 'A closed day has no hours' });
  if (!v.isClosed && (!v.openTime || !v.closeTime || v.openTime >= v.closeTime)) {
    ctx.addIssue({ code: 'custom', path: ['closeTime'], message: 'Opens before it closes' });
  }
});
export type HolidayInput = z.infer<typeof holidaySchema>;

/** GET /settings/holidays filters. */
export const holidayListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  /** A branch id, or absent = organization-wide rows and every branch's rows. */
  branchId: z.string().uuid().optional(),
});
