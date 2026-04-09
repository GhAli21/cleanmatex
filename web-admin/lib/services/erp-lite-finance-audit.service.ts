import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';
import type { ErpLitePostActionAuditRow } from '@/lib/types/erp-lite-ops';

export class ErpLiteFinanceAuditService {
  static async listPostActions(limit = 200): Promise<ErpLitePostActionAuditRow[]> {
    const tenantId = await this.requireTenantId();
    const take = Math.min(Math.max(1, limit), 500);

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          action_domain: string;
          action_code: string;
          result_code: string;
          period_id: string | null;
          exception_id: string | null;
          usage_map_id: string | null;
          posting_log_id: string | null;
          prev_status_code: string | null;
          new_status_code: string | null;
          action_notes: string | null;
          actor_user_id: string;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT
          a.id,
          a.action_domain,
          a.action_code,
          a.result_code,
          a.period_id::text,
          a.exception_id::text,
          a.usage_map_id::text,
          a.posting_log_id::text,
          a.prev_status_code,
          a.new_status_code,
          a.action_notes,
          a.actor_user_id,
          a.created_at
        FROM public.org_fin_post_action_tr a
        WHERE a.tenant_org_id = ${tenantId}::uuid
          AND a.rec_status = 1
        ORDER BY a.created_at DESC
        LIMIT ${take}
      `);

      return rows.map((r) => ({
        id: r.id,
        action_domain: r.action_domain,
        action_code: r.action_code,
        result_code: r.result_code,
        period_id: r.period_id,
        exception_id: r.exception_id,
        usage_map_id: r.usage_map_id,
        posting_log_id: r.posting_log_id,
        prev_status_code: r.prev_status_code,
        new_status_code: r.new_status_code,
        action_notes: r.action_notes,
        actor_user_id: r.actor_user_id,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) throw new Error('Tenant context required');
    await assertErpLiteEnabledForTenant(tenantId);
    return tenantId;
  }
}
