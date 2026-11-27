import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/**
 * The time-zone catalog (`sys_timezone_cd`, D28/D32) for pickers and server checks (G2).
 * Read on the server with the service connection; the table stays closed to anon and
 * authenticated (`0745`).
 */
export interface TimeZoneCatalogRow {
  code: string;
  name: string | null;
  name2: string | null;
  region: string | null;
}

/** Active canonical zones for a picker, by region then name. */
export async function listActiveTimeZones(): Promise<TimeZoneCatalogRow[]> {
  const rows = await prisma.sys_timezone_cd.findMany({
    where: { is_active: true, rec_status: 1 },
    select: { code: true, name: true, name2: true, region: true },
    orderBy: [{ region: 'asc' }, { code: 'asc' }],
  });
  return rows.map((r) => ({ code: r.code, name: r.name ?? null, name2: r.name2 ?? null, region: r.region ?? null }));
}

type ZoneDb = { $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T> };

/**
 * The canonical active catalog code for `name` (an alias such as `Asia/Calcutta` becomes
 * `Asia/Kolkata`), or null when the name is not an active zone. Same rule as the database
 * zone validators (`fn_cmx_dt__accept_zone`, `0842`).
 */
export async function canonicalActiveZoneOn(db: ZoneDb, name: string | null | undefined): Promise<string | null> {
  const value = (name ?? '').trim();
  if (!value || value.length > 64) return null;
  const rows = await db.$queryRaw<Array<{ zone: string | null }>>(Prisma.sql`
    SELECT CASE WHEN public.fn_cmx_dt_is_valid_zone(c.zone) THEN c.zone END AS zone
      FROM (SELECT public.fn_cmx_dt_canonical_zone(${value}) AS zone) c
  `);
  return rows[0]?.zone ?? null;
}

/** {@link canonicalActiveZoneOn} on the shared client. */
export function canonicalActiveZone(name: string | null | undefined): Promise<string | null> {
  return canonicalActiveZoneOn(prisma, name);
}
