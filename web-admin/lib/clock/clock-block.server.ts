import 'server-only';

/**
 * Builds the screen `clock` block (D21, D34) from the SQL clock API (0842/0843):
 * `fn_cmx_dt_zone` for the operations zone and `fn_cmx_dt_settings` for hour cycle, week start,
 * cut-over and date format. Runs on the server connection (no user JWT), so public pages get the
 * shop zone without the anon key ever calling the zone door (§7.5).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  buildClockBlock,
  dowToIsoWeekday,
  isOperationalZoneOperation,
  systemClock,
  toPublicClockBlock,
  ClockError,
  type Clock,
  type ClockBlock,
  type DateFormat,
  type OperationalZoneOperation,
  type PublicClockBlock,
} from '@cmx/clock';

type ClockQueryClient = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};

const DATE_FORMATS: readonly DateFormat[] = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];

type ClockRow = {
  zone: string | null;
  hour_cycle: string;
  week_start: number;
  cutover: string;
  date_format: string;
};

export interface ScreenClockInput {
  tenantOrgId: string;
  operation: OperationalZoneOperation;
  /** Owning branch; null reads the organization scope. */
  branchId: string | null;
  clock?: Clock;
}

/** One query: zone plus resolved settings. Null when the organization does not exist. */
export async function getScreenClockBlockOn(db: ClockQueryClient, input: ScreenClockInput): Promise<ClockBlock | null> {
  if (!isOperationalZoneOperation(input.operation)) {
    throw new ClockError('CLOCK_SETTING_INVALID', { operation: input.operation });
  }
  const branch = input.branchId ?? null;
  const rows = await db.$queryRaw<ClockRow[]>(Prisma.sql`
    SELECT public.fn_cmx_dt_zone(${input.tenantOrgId}::uuid, ${input.operation}, ${branch}::uuid) AS zone,
           s.hour_cycle,
           s.week_start::int AS week_start,
           to_char(s.cutover, 'HH24:MI') AS cutover,
           s.date_format
      FROM public.fn_cmx_dt_settings(${input.tenantOrgId}::uuid, ${branch}::uuid) s
  `);
  const row = rows[0];
  if (!row) return null;
  if (!DATE_FORMATS.includes(row.date_format as DateFormat)) {
    throw new ClockError('CLOCK_SETTING_INVALID', { dateFormat: row.date_format });
  }
  return buildClockBlock({
    clock: input.clock ?? systemClock,
    zone: row.zone,
    cutover: row.cutover,
    hourCycle: row.hour_cycle,
    weekStart: dowToIsoWeekday(Number(row.week_start)),
    dateFormat: row.date_format as DateFormat,
  });
}

export function getScreenClockBlock(input: ScreenClockInput): Promise<ClockBlock | null> {
  return getScreenClockBlockOn(prisma, input);
}

/** The public subset (zone, serverNow, hourCycle, dateFormat) for anon pages (§7.16). */
export async function getPublicClockBlock(input: ScreenClockInput): Promise<PublicClockBlock | null> {
  const block = await getScreenClockBlock(input);
  return block ? toPublicClockBlock(block) : null;
}
