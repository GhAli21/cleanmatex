import 'server-only';

/**
 * Clock health (§7.7, S7): one read-only snapshot of the time machinery for an organization.
 *
 * - Runtime: Node tz database (`process.versions.tz`) and ICU versions.
 * - Skew: app clock vs `fn_cmx_dt_now()`, measured at the middle of the round trip.
 * - tzdb agreement: three recent-rule vectors converted by Postgres (`fn_cmx_dt_instant_at_zone`)
 *   and by `@cmx/clock`, both compared with the known answer (CLOCK_TZDB_SKEW when any differ).
 * - Findings: `fn_cmx_dt_health(tenant)` rows (zone missing/invalid/non-canonical, catalog unknown,
 *   role tz, CLOCK_FAKE_ENV = fake_now possible outside test) scoped to the caller's organization.
 *
 * Runs on the server connection; nothing is written.
 */
import { Prisma } from '@prisma/client';
import { dtInstantAtZone, tzdbVersion } from '@cmx/clock';

type HealthQueryClient = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};

export type ClockHealthSeverity = 'error' | 'warning' | 'info';

export interface ClockHealthFinding {
  checkCode: string;
  severity: ClockHealthSeverity;
  branchId: string | null;
  detail: unknown;
}

export interface ClockHealthVector {
  zone: string;
  date: string;
  time: string;
  expected: string;
  app: string | null;
  db: string | null;
  ok: boolean;
}

export interface ClockHealthReport {
  status: 'ok' | 'warning' | 'error';
  checkedAt: string;
  runtime: { tzdbVersion: string | null; icuVersion: string | null; nodeVersion: string };
  db: { now: string | null; skewMs: number | null; roundTripMs: number | null };
  vectors: ClockHealthVector[];
  findings: ClockHealthFinding[];
}

/** Zones whose rules changed recently; a stale tz database answers these wrongly. */
export const CLOCK_HEALTH_VECTORS: ReadonlyArray<Omit<ClockHealthVector, 'app' | 'db' | 'ok'>> = [
  // Mexico dropped DST from 2022-10-30 (tzdata 2022f): no +1h on 2023-04-02.
  { zone: 'America/Mexico_City', date: '2023-04-02', time: '12:00', expected: '2023-04-02T18:00:00.000Z' },
  // Greenland moved to UTC-2 standard time on 2023-10-28 (tzdata 2022g/2023a).
  { zone: 'America/Nuuk', date: '2024-01-15', time: '12:00', expected: '2024-01-15T14:00:00.000Z' },
  // Kazakhstan unified on UTC+5 on 2024-03-01 (tzdata 2024a).
  { zone: 'Asia/Almaty', date: '2024-06-01', time: '12:00', expected: '2024-06-01T07:00:00.000Z' },
];

/** Skew beyond this many milliseconds is a warning. */
export const CLOCK_SKEW_WARN_MS = 2000;

type DbRow = { db_now: Date | null; v0: Date | null; v1: Date | null; v2: Date | null };
type FindingRow = { check_code: string; severity: string; branch_id: string | null; detail: unknown };

const iso = (d: Date | null | undefined): string | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

function appVector(zone: string, date: string, time: string): string | null {
  try {
    return dtInstantAtZone(zone, date, time, 'compatible').toISOString();
  } catch {
    return null;
  }
}

const SEVERITIES: readonly ClockHealthSeverity[] = ['error', 'warning', 'info'];

/**
 * Builds the clock health report for one organization.
 * @param db - server connection (Prisma client or a transaction)
 * @param tenantOrgId - the caller's organization (from the session, never from input)
 * @param now - app clock reader (injectable for tests)
 */
export async function getClockHealth(
  db: HealthQueryClient,
  tenantOrgId: string,
  now: () => number = Date.now,
): Promise<ClockHealthReport> {
  const [a, b, c] = CLOCK_HEALTH_VECTORS;
  const t0 = now();
  const rows = await db.$queryRaw<DbRow[]>(Prisma.sql`
    SELECT public.fn_cmx_dt_now() AS db_now,
           public.fn_cmx_dt_instant_at_zone(${a.zone}, ${a.date}::date, ${a.time}::time, 'compatible') AS v0,
           public.fn_cmx_dt_instant_at_zone(${b.zone}, ${b.date}::date, ${b.time}::time, 'compatible') AS v1,
           public.fn_cmx_dt_instant_at_zone(${c.zone}, ${c.date}::date, ${c.time}::time, 'compatible') AS v2`);
  const t1 = now();
  const row = rows[0];
  const dbNow = iso(row?.db_now);
  // fn_cmx_dt_now() is the transaction start; compare it with the middle of the round trip.
  const skewMs = dbNow ? Math.round((t0 + t1) / 2 - Date.parse(dbNow)) : null;

  const dbVectors = [row?.v0, row?.v1, row?.v2];
  const vectors: ClockHealthVector[] = CLOCK_HEALTH_VECTORS.map((v, i) => {
    const app = appVector(v.zone, v.date, v.time);
    const dbv = iso(dbVectors[i]);
    return { ...v, app, db: dbv, ok: app === v.expected && dbv === v.expected };
  });

  const findingRows = await db.$queryRaw<FindingRow[]>(Prisma.sql`
    SELECT h.check_code, h.severity, h.branch_id, h.detail
      FROM public.fn_cmx_dt_health(${tenantOrgId}::uuid) h`);
  const findings: ClockHealthFinding[] = findingRows.map((f) => ({
    checkCode: f.check_code,
    severity: SEVERITIES.includes(f.severity as ClockHealthSeverity) ? (f.severity as ClockHealthSeverity) : 'error',
    branchId: f.branch_id ?? null,
    detail: f.detail ?? null,
  }));

  const bad = vectors.filter((v) => !v.ok);
  if (bad.length > 0) {
    findings.push({
      checkCode: 'CLOCK_TZDB_SKEW',
      severity: 'error',
      branchId: null,
      detail: { vectors: bad.map((v) => ({ zone: v.zone, expected: v.expected, app: v.app, db: v.db })) },
    });
  }
  if (skewMs === null || Math.abs(skewMs) > CLOCK_SKEW_WARN_MS) {
    findings.push({
      checkCode: 'CLOCK_DB_SKEW',
      severity: skewMs === null ? 'error' : 'warning',
      branchId: null,
      detail: { skewMs, limitMs: CLOCK_SKEW_WARN_MS },
    });
  }

  const status = findings.some((f) => f.severity === 'error')
    ? 'error'
    : findings.some((f) => f.severity === 'warning')
      ? 'warning'
      : 'ok';

  return {
    status,
    checkedAt: new Date(t1).toISOString(),
    runtime: {
      tzdbVersion: tzdbVersion(),
      icuVersion: process.versions.icu ?? null,
      nodeVersion: process.versions.node,
    },
    db: { now: dbNow, skewMs, roundTripMs: t1 - t0 },
    vectors,
    findings,
  };
}
