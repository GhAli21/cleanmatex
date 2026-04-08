import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';
import type {
  ErpLiteTenantReadiness,
  ErpLiteMissingUsageRow,
} from '@/lib/types/erp-lite-ops';

export class ErpLiteReadinessService {
  // -------------------------------------------------------
  // Readiness snapshot for the current tenant
  // -------------------------------------------------------
  static async getReadiness(): Promise<ErpLiteTenantReadiness | null> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      type RawRow = {
        tenant_org_id: string;
        missing_required_mappings: string;
        total_required_mappings: string;
        open_exception_count: string;
        open_period_count: string;
        last_template_applied_at: Date | null;
        last_template_pkg_code: string | null;
        last_apply_status: string | null;
        last_posted_at: Date | null;
        last_failed_at: Date | null;
        total_coa_accounts: string;
        postable_coa_accounts: string;
        inactive_coa_accounts: string;
        has_gov_assignment: boolean;
        readiness_status: string;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT *
        FROM public.vw_fin_tenant_readiness
        WHERE tenant_org_id = ${tenantId}::uuid
        LIMIT 1
      `);

      if (rows.length === 0) return null;

      const r = rows[0];
      return {
        tenant_org_id: r.tenant_org_id,
        missing_required_mappings: Number(r.missing_required_mappings),
        total_required_mappings: Number(r.total_required_mappings),
        open_exception_count: Number(r.open_exception_count),
        open_period_count: Number(r.open_period_count),
        last_template_applied_at: r.last_template_applied_at
          ? r.last_template_applied_at.toISOString()
          : null,
        last_template_pkg_code: r.last_template_pkg_code,
        last_apply_status: r.last_apply_status,
        last_posted_at: r.last_posted_at ? r.last_posted_at.toISOString() : null,
        last_failed_at: r.last_failed_at ? r.last_failed_at.toISOString() : null,
        total_coa_accounts: Number(r.total_coa_accounts),
        postable_coa_accounts: Number(r.postable_coa_accounts),
        inactive_coa_accounts: Number(r.inactive_coa_accounts),
        has_gov_assignment: r.has_gov_assignment,
        readiness_status: r.readiness_status as ErpLiteTenantReadiness['readiness_status'],
      };
    });
  }

  // -------------------------------------------------------
  // Missing-mapping details (required usage codes with issues)
  // -------------------------------------------------------
  static async getMissingUsage(locale: 'en' | 'ar' = 'en'): Promise<ErpLiteMissingUsageRow[]> {
    const tenantId = await this.requireTenantId();
    const nameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(v.usage_code_name2, v.usage_code_name)`
        : Prisma.sql`v.usage_code_name`;

    return withTenantContext(tenantId, async () => {
      type RawRow = {
        tenant_org_id: string;
        usage_code_id: string;
        usage_code: string;
        usage_code_name: string;
        usage_code_name2: string | null;
        is_required: boolean;
        required_acc_type_code: string | null;
        required_acc_type_name: string | null;
        mapping_id: string | null;
        mapped_account_id: string | null;
        mapped_account_code: string | null;
        mapped_account_name: string | null;
        mapped_acc_type_code: string | null;
        mapping_issue: string;
        effective_from: string | null;
        effective_to: string | null;
        mapping_status: string | null;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          v.tenant_org_id,
          v.usage_code_id,
          v.usage_code,
          ${nameSql} AS usage_code_name,
          v.usage_code_name2,
          v.is_required,
          v.required_acc_type_code,
          v.required_acc_type_name,
          v.mapping_id,
          v.mapped_account_id,
          v.mapped_account_code,
          v.mapped_account_name,
          v.mapped_acc_type_code,
          v.mapping_issue,
          TO_CHAR(v.effective_from, 'YYYY-MM-DD') AS effective_from,
          TO_CHAR(v.effective_to,   'YYYY-MM-DD') AS effective_to,
          v.mapping_status
        FROM public.vw_fin_missing_required_usage v
        WHERE v.tenant_org_id = ${tenantId}::uuid
        ORDER BY v.is_required DESC, v.usage_code
      `);

      return rows.map((r) => ({
        ...r,
        mapping_issue: r.mapping_issue as ErpLiteMissingUsageRow['mapping_issue'],
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
