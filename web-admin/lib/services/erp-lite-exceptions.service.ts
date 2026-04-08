import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';
import { getAuthContext } from '@/lib/auth/server-auth';
import type {
  ErpLiteOpenExceptionRow,
  ExceptionStatus,
  ResolveExceptionInput,
} from '@/lib/types/erp-lite-ops';

export class ErpLiteExceptionsService {
  // -------------------------------------------------------
  // List open (non-terminal) exceptions for the current tenant
  // -------------------------------------------------------
  static async listOpenExceptions(): Promise<ErpLiteOpenExceptionRow[]> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      type RawRow = Omit<
        ErpLiteOpenExceptionRow,
        'created_at' | 'resolved_at'
      > & {
        created_at: Date;
        resolved_at: Date | null;
        attempt_no: string | null;
        mapping_rule_version_no: string | null;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT *
        FROM public.vw_fin_open_exceptions
        WHERE tenant_org_id = ${tenantId}::uuid
        ORDER BY created_at DESC
      `);

      return rows.map((r) => ({
        ...r,
        exception_type_code:
          r.exception_type_code as ErpLiteOpenExceptionRow['exception_type_code'],
        status_code: r.status_code as ExceptionStatus,
        created_at:
          r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        resolved_at:
          r.resolved_at instanceof Date ? r.resolved_at.toISOString() : r.resolved_at,
        attempt_no: r.attempt_no != null ? Number(r.attempt_no) : null,
        mapping_rule_version_no:
          r.mapping_rule_version_no != null ? Number(r.mapping_rule_version_no) : null,
      }));
    });
  }

  // -------------------------------------------------------
  // Resolve / ignore / close an exception
  // -------------------------------------------------------
  static async resolveException(input: ResolveExceptionInput): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    const newStatus: ExceptionStatus =
      input.action === 'RESOLVE'
        ? 'RESOLVED'
        : input.action === 'IGNORE'
          ? 'IGNORED'
          : 'CLOSED';

    const actionCode =
      input.action === 'RESOLVE'
        ? 'RESOLVE'
        : input.action === 'IGNORE'
          ? 'IGNORE'
          : 'CLOSE';

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE public.org_fin_post_exc_tr
        SET status_code      = ${newStatus},
            resolution_notes = ${input.resolution_notes},
            resolved_at      = NOW(),
            resolved_by      = ${auth.userId},
            updated_at       = NOW(),
            updated_by       = ${auth.userId}
        WHERE id            = ${input.exception_id}::uuid
          AND tenant_org_id = ${tenantId}::uuid
          AND status_code NOT IN ('RESOLVED', 'IGNORED', 'CLOSED')
          AND rec_status    = 1
      `);

      await this.writeActionAudit(tenantId, auth.userId, {
        action_domain: 'EXCEPTION',
        action_code: actionCode,
        exception_id: input.exception_id,
        new_status_code: newStatus,
        action_notes: input.resolution_notes ?? null,
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
