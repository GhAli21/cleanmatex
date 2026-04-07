import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
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
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }
}
