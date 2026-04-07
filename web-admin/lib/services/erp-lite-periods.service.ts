import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { getAuthContext } from '@/lib/auth/server-auth';
import type {
  ErpLitePeriodRow,
  CreatePeriodInput,
  ClosePeriodInput,
  PeriodStatus,
} from '@/lib/types/erp-lite-ops';

export class ErpLitePeriodsService {
  // -------------------------------------------------------
  // List all periods for the current tenant
  // -------------------------------------------------------
  static async listPeriods(locale: 'en' | 'ar' = 'en'): Promise<ErpLitePeriodRow[]> {
    const tenantId = await this.requireTenantId();
    const nameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(p.name2, p.name)`
        : Prisma.sql`p.name`;

    return withTenantContext(tenantId, async () => {
      type RawRow = {
        id: string;
        tenant_org_id: string;
        period_code: string;
        name: string;
        name2: string | null;
        description: string | null;
        start_date: Date;
        end_date: Date;
        status_code: string;
        lock_reason: string | null;
        closed_at: Date | null;
        closed_by: string | null;
        is_active: boolean;
        created_at: Date;
        updated_at: Date | null;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          p.id,
          p.tenant_org_id,
          p.period_code,
          ${nameSql}                                  AS name,
          p.name2,
          p.description,
          TO_CHAR(p.start_date, 'YYYY-MM-DD')        AS start_date,
          TO_CHAR(p.end_date,   'YYYY-MM-DD')        AS end_date,
          p.status_code,
          p.lock_reason,
          p.closed_at,
          p.closed_by,
          p.is_active,
          p.created_at,
          p.updated_at
        FROM public.org_fin_period_mst p
        WHERE p.tenant_org_id = ${tenantId}::uuid
          AND p.rec_status    = 1
        ORDER BY p.start_date DESC
      `);

      return rows.map((r) => ({
        ...r,
        status_code: r.status_code as PeriodStatus,
        start_date: r.start_date instanceof Date
          ? r.start_date.toISOString().slice(0, 10)
          : (r.start_date as string),
        end_date: r.end_date instanceof Date
          ? r.end_date.toISOString().slice(0, 10)
          : (r.end_date as string),
        closed_at: r.closed_at instanceof Date ? r.closed_at.toISOString() : r.closed_at,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at as string),
        updated_at:
          r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      }));
    });
  }

  // -------------------------------------------------------
  // Create a new OPEN period
  // -------------------------------------------------------
  static async createPeriod(input: CreatePeriodInput): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.org_fin_period_mst
          (tenant_org_id, period_code, name, name2, description,
           start_date, end_date, status_code,
           created_at, created_by, rec_status, is_active)
        VALUES (
          ${tenantId}::uuid,
          ${input.period_code},
          ${input.name},
          ${input.name2 ?? null},
          ${input.description ?? null},
          ${input.start_date}::date,
          ${input.end_date}::date,
          'OPEN',
          NOW(), ${auth.userId}, 1, true
        )
      `);
    });
  }

  // -------------------------------------------------------
  // Close an OPEN period
  // -------------------------------------------------------
  static async closePeriod(input: ClosePeriodInput): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE public.org_fin_period_mst
        SET status_code  = 'CLOSED',
            lock_reason  = ${input.lock_reason ?? null},
            closed_at    = NOW(),
            closed_by    = ${auth.userId},
            updated_at   = NOW(),
            updated_by   = ${auth.userId}
        WHERE id            = ${input.period_id}::uuid
          AND tenant_org_id = ${tenantId}::uuid
          AND status_code   = 'OPEN'
          AND rec_status    = 1
      `);
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }
}
