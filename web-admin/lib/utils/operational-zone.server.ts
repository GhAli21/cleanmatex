import 'server-only';

import { cache } from 'react';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { isValidTimeZone } from '@/lib/utils/business-date';
import {
  civilDateInZone,
  isOperationalZoneOperation,
  type OperationalZoneOperation,
} from '@/lib/utils/operational-time';

type ZoneQueryClient = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};

/**
 * Raised when an action needs a civil day and neither the branch nor the
 * organization has a valid active timezone. Callers must not substitute UTC.
 */
export class OperationalZoneMissingError extends Error {
  readonly code = 'TIMEZONE_NOT_CONFIGURED';

  constructor() {
    super('TIMEZONE_NOT_CONFIGURED');
  }
}

export type OperationalZoneInput = {
  tenantOrgId: string;
  operation: OperationalZoneOperation;
  /** Owning branch. Null reads the organization zone only. */
  branchId: string | null;
};

/**
 * One indexed read: the branch zone when it is an active `sys_timezone_cd` code,
 * otherwise the organization zone, otherwise null. The operation is part of the
 * contract so the SQL door can take the same inputs. The branch id is the scope
 * for every current operation, including delivery, invoice, and ledger.
 */
export async function resolveOperationalTimeZoneOn(
  db: ZoneQueryClient,
  input: OperationalZoneInput,
): Promise<string | null> {
  if (!isOperationalZoneOperation(input.operation)) return null;
  const branchJoin = input.branchId
    ? Prisma.sql`LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = t.id
       AND b.id = ${input.branchId}::uuid`
    : Prisma.sql`LEFT JOIN public.org_branches_mst b ON FALSE`;
  const rows = await db.$queryRaw<Array<{ timezone: string | null }>>(Prisma.sql`
    SELECT CASE
      WHEN bz.code IS NOT NULL THEN b.timezone_code
      WHEN oz.code IS NOT NULL THEN t.timezone
      ELSE NULL
    END AS timezone
    FROM public.org_tenants_mst t
    ${branchJoin}
    LEFT JOIN public.sys_timezone_cd bz
      ON bz.code = b.timezone_code
     AND bz.is_active IS TRUE
    LEFT JOIN public.sys_timezone_cd oz
      ON oz.code = t.timezone
     AND oz.is_active IS TRUE
    WHERE t.id = ${input.tenantOrgId}::uuid
    LIMIT 1
  `);
  const zone = rows[0]?.timezone ?? null;
  return isValidTimeZone(zone) ? zone : null;
}

/** Request-scoped reuse. A transaction passes its own client to {@link resolveOperationalTimeZoneOn}. */
export const resolveOperationalTimeZone = cache(
  (tenantOrgId: string, operation: OperationalZoneOperation, branchId: string | null) =>
    resolveOperationalTimeZoneOn(prisma, { tenantOrgId, operation, branchId }),
);

/**
 * YYYYMM for a human code. A document date wins. Otherwise the month is the
 * civil month of one database instant in the organization zone.
 */
export async function civilYearMonthToken(
  db: ZoneQueryClient,
  tenantOrgId: string,
  civilDate?: string | null,
): Promise<string> {
  if (civilDate && /^\d{4}-\d{2}-\d{2}$/.test(civilDate)) {
    return `${civilDate.slice(0, 4)}${civilDate.slice(5, 7)}`;
  }
  const zone = await resolveOperationalTimeZoneOn(db, {
    tenantOrgId,
    operation: 'ledger',
    branchId: null,
  });
  if (!zone) throw new OperationalZoneMissingError();
  const rows = await db.$queryRaw<Array<{ instant: Date }>>(
    Prisma.sql`SELECT clock_timestamp() AS instant`,
  );
  const day = civilDateInZone(rows[0]?.instant, zone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new OperationalZoneMissingError();
  return `${day.slice(0, 4)}${day.slice(5, 7)}`;
}

/** Civil today for one action. Empty when the operations zone is missing. */
export async function operationalCivilToday(
  tenantOrgId: string,
  operation: OperationalZoneOperation,
  branchId: string | null,
): Promise<string> {
  const zone = await resolveOperationalTimeZone(tenantOrgId, operation, branchId);
  return civilDateInZone(new Date(), zone);
}

export function resolveOrganizationTimeZone(tenantOrgId: string): Promise<string | null> {
  return resolveOperationalTimeZone(tenantOrgId, 'accept_order', null);
}

/**
 * One read for a list. Each returned branch zone is the active branch code,
 * otherwise the organization code. A branch that is not in the result uses
 * `organization`.
 */
export async function resolveOperationalTimeZonesForBranches(
  db: ZoneQueryClient,
  tenantOrgId: string,
  operation: OperationalZoneOperation,
  branchIds: readonly string[],
): Promise<{ organization: string | null; byBranch: ReadonlyMap<string, string | null> }> {
  if (!isOperationalZoneOperation(operation)) {
    return { organization: null, byBranch: new Map() };
  }
  const ids = [...new Set(branchIds.filter((id) => id.length > 0))];
  const branchJoin = ids.length > 0
    ? Prisma.sql`LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = t.id
       AND b.id = ANY(${ids}::uuid[])`
    : Prisma.sql`LEFT JOIN public.org_branches_mst b ON FALSE`;
  const rows = await db.$queryRaw<Array<{ branch_id: string | null; timezone: string | null; organization_zone: string | null }>>(Prisma.sql`
    SELECT b.id::text AS branch_id,
           CASE
             WHEN bz.code IS NOT NULL THEN b.timezone_code
             WHEN oz.code IS NOT NULL THEN t.timezone
             ELSE NULL
           END AS timezone,
           CASE WHEN oz.code IS NOT NULL THEN t.timezone ELSE NULL END AS organization_zone
    FROM public.org_tenants_mst t
    ${branchJoin}
    LEFT JOIN public.sys_timezone_cd bz
      ON bz.code = b.timezone_code
     AND bz.is_active IS TRUE
    LEFT JOIN public.sys_timezone_cd oz
      ON oz.code = t.timezone
     AND oz.is_active IS TRUE
    WHERE t.id = ${tenantOrgId}::uuid
  `);
  const organization = isValidTimeZone(rows[0]?.organization_zone) ? rows[0].organization_zone : null;
  const byBranch = new Map<string, string | null>();
  for (const row of rows) {
    if (!row.branch_id) continue;
    byBranch.set(row.branch_id, isValidTimeZone(row.timezone) ? row.timezone : null);
  }
  return { organization, byBranch };
}

/** One database instant. Callers that assign a civil day persist this same value. */
export async function readDatabaseInstant(db: ZoneQueryClient): Promise<Date> {
  const rows = await db.$queryRaw<Array<{ at: Date | string }>>(Prisma.sql`SELECT clock_timestamp() AS at`);
  const at = rows[0]?.at;
  const instant = at instanceof Date ? at : new Date(at ?? '');
  if (Number.isNaN(instant.getTime())) {
    throw new OperationalZoneMissingError();
  }
  return instant;
}
