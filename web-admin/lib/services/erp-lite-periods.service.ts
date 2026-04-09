import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';
import { getAuthContext } from '@/lib/auth/server-auth';
import type {
  ErpLitePeriodRow,
  CreatePeriodInput,
  ClosePeriodInput,
  PeriodClosePrecheckResult,
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
  // Period close precheck (draft journals + open exceptions in-range)
  // -------------------------------------------------------
  static async precheckPeriodClose(periodId: string): Promise<PeriodClosePrecheckResult> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      type PeriodHead = {
        id: string;
        period_code: string;
        start_date: string;
        end_date: string;
        status_code: string;
      };

      const head = await prisma.$queryRaw<PeriodHead[]>(Prisma.sql`
        SELECT
          p.id,
          p.period_code,
          TO_CHAR(p.start_date, 'YYYY-MM-DD') AS start_date,
          TO_CHAR(p.end_date, 'YYYY-MM-DD')   AS end_date,
          p.status_code
        FROM public.org_fin_period_mst p
        WHERE p.id = ${periodId}::uuid
          AND p.tenant_org_id = ${tenantId}::uuid
          AND p.rec_status = 1
        LIMIT 1
      `);

      if (head.length === 0) {
        throw new Error('Period not found');
      }

      const p = head[0];
      const periodSlice = {
        id: p.id,
        period_code: p.period_code,
        start_date: p.start_date,
        end_date: p.end_date,
        status_code: p.status_code as PeriodStatus,
      };

      const blockers: PeriodClosePrecheckResult['blockers'] = [];

      if (p.status_code !== 'OPEN') {
        blockers.push({
          severity: 'error',
          code: 'PERIOD_NOT_OPEN',
          message: `Period ${p.period_code} is ${p.status_code} and cannot be closed.`,
        });
        return { canClose: false, period: periodSlice, blockers };
      }

      const draftRow = await prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM public.org_fin_journal_mst j
        WHERE j.tenant_org_id = ${tenantId}::uuid
          AND j.rec_status = 1
          AND j.status_code = 'DRAFT'
          AND j.posting_date >= ${p.start_date}::date
          AND j.posting_date <= ${p.end_date}::date
      `);
      const draftCount = Number(draftRow[0]?.c ?? 0n);
      if (draftCount > 0) {
        blockers.push({
          severity: 'error',
          code: 'DRAFT_JOURNALS',
          message: `${draftCount} draft journal(s) exist with posting dates in this period.`,
          href: `/dashboard/erp-lite/gl?dateFrom=${encodeURIComponent(p.start_date)}&dateTo=${encodeURIComponent(p.end_date)}`,
        });
      }

      const excRow = await prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT e.exception_id)::bigint AS c
        FROM public.vw_fin_open_exceptions e
        WHERE e.tenant_org_id = ${tenantId}::uuid
          AND e.journal_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.org_fin_journal_mst j
            WHERE j.id = e.journal_id
              AND j.tenant_org_id = e.tenant_org_id
              AND j.posting_date >= ${p.start_date}::date
              AND j.posting_date <= ${p.end_date}::date
          )
      `);
      const excCount = Number(excRow[0]?.c ?? 0n);
      if (excCount > 0) {
        blockers.push({
          severity: 'error',
          code: 'OPEN_EXCEPTIONS',
          message: `${excCount} open posting exception(s) are linked to journals in this period.`,
          href: '/dashboard/erp-lite/exceptions',
        });
      }

      const orphanExc = await prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM public.vw_fin_open_exceptions e
        WHERE e.tenant_org_id = ${tenantId}::uuid
          AND e.journal_id IS NULL
      `);
      const orphanCount = Number(orphanExc[0]?.c ?? 0n);
      if (orphanCount > 0) {
        blockers.push({
          severity: 'warning',
          code: 'OPEN_EXCEPTIONS_NO_JOURNAL',
          message: `${orphanCount} open exception(s) have no resolved journal context — review before closing.`,
          href: '/dashboard/erp-lite/exceptions',
        });
      }

      const canClose = !blockers.some((b) => b.severity === 'error');
      return { canClose, period: periodSlice, blockers };
    });
  }

  // -------------------------------------------------------
  // Close an OPEN period
  // -------------------------------------------------------
  static async closePeriod(input: ClosePeriodInput): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    const pre = await this.precheckPeriodClose(input.period_id);
    if (!pre.canClose) {
      const msg = pre.blockers
        .filter((b) => b.severity === 'error')
        .map((b) => b.message)
        .join(' ');
      throw new Error(msg || 'Period cannot be closed until blockers are resolved.');
    }

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

      await this.writeActionAudit(tenantId, auth.userId, {
        action_domain: 'PERIOD',
        action_code: 'CLOSE',
        period_id: input.period_id,
        prev_status_code: 'OPEN',
        new_status_code: 'CLOSED',
        action_notes: input.lock_reason ?? null,
      });
    });
  }

  private static async writeActionAudit(
    tenantId: string,
    actorUserId: string,
    params: {
      action_domain: string;
      action_code: string;
      exception_id?: string;
      period_id?: string;
      usage_map_id?: string;
      prev_status_code?: string;
      new_status_code?: string;
      action_notes?: string | null;
    }
  ): Promise<void> {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.org_fin_post_action_tr (
          tenant_org_id, action_domain, action_code,
          exception_id, period_id, usage_map_id,
          prev_status_code, new_status_code, action_notes,
          result_code, actor_user_id,
          created_at, created_by, created_info, rec_status, is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${params.action_domain},
          ${params.action_code},
          ${params.exception_id ?? null}::uuid,
          ${params.period_id ?? null}::uuid,
          ${params.usage_map_id ?? null}::uuid,
          ${params.prev_status_code ?? null},
          ${params.new_status_code ?? null},
          ${params.action_notes ?? null},
          'SUCCESS',
          ${actorUserId},
          NOW(), ${actorUserId}, 'ERP-Lite ops action', 1, true
        )
      `);
    } catch {
      // Audit write failure must not block the primary mutation.
    }
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    await assertErpLiteEnabledForTenant(tenantId);
    return tenantId;
  }
}
