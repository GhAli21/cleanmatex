import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { getAuthContext } from '@/lib/auth/server-auth';
import type {
  ErpLiteUsageMapRow,
  CreateUsageMapInput,
} from '@/lib/types/erp-lite-ops';

export class ErpLiteUsageMapService {
  // -------------------------------------------------------
  // List all usage maps for the current tenant with enrichment
  // -------------------------------------------------------
  static async listUsageMaps(locale: 'en' | 'ar' = 'en'): Promise<ErpLiteUsageMapRow[]> {
    const tenantId = await this.requireTenantId();
    const ucNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(uc.name2, uc.name)`
        : Prisma.sql`uc.name`;
    const accNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(a.name2, a.name)`
        : Prisma.sql`a.name`;
    const branchNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(b.name2, b.name)`
        : Prisma.sql`b.name`;

    return withTenantContext(tenantId, async () => {
      type RawRow = {
        id: string;
        tenant_org_id: string;
        branch_id: string | null;
        branch_name: string | null;
        usage_code_id: string;
        usage_code: string;
        usage_code_name: string;
        usage_code_name2: string | null;
        is_required: boolean;
        account_id: string;
        account_code: string;
        account_name: string;
        account_name2: string | null;
        acc_type_code: string | null;
        acc_type_name: string | null;
        required_acc_type_code: string | null;
        status_code: string;
        effective_from: string | null;
        effective_to: string | null;
        is_active: boolean;
        created_at: Date;
        updated_at: Date | null;
        mapping_issue: string;
      };

      const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          m.id,
          m.tenant_org_id,
          m.branch_id,
          ${branchNameSql}                                  AS branch_name,
          m.usage_code_id,
          uc.usage_code,
          ${ucNameSql}                                      AS usage_code_name,
          uc.name2                                          AS usage_code_name2,
          uc.is_required_v1                                 AS is_required,
          m.account_id,
          a.account_code,
          ${accNameSql}                                     AS account_name,
          a.name2                                           AS account_name2,
          at2.acc_type_code,
          at2.name                                          AS acc_type_name,
          at_req.acc_type_code                              AS required_acc_type_code,
          m.status_code,
          TO_CHAR(m.effective_from, 'YYYY-MM-DD')          AS effective_from,
          TO_CHAR(m.effective_to,   'YYYY-MM-DD')          AS effective_to,
          m.is_active,
          m.created_at,
          m.updated_at,
          CASE
            WHEN m.is_active = false                        THEN 'ACCOUNT_INACTIVE'
            WHEN a.is_active = false                        THEN 'ACCOUNT_INACTIVE'
            WHEN a.is_postable = false                      THEN 'ACCOUNT_NOT_POSTABLE'
            WHEN a.acc_type_id <> uc.primary_acc_type_id    THEN 'TYPE_MISMATCH'
            ELSE 'OK'
          END                                               AS mapping_issue
        FROM public.org_fin_usage_map_mst m
        JOIN public.sys_fin_usage_code_cd uc  ON uc.usage_code_id = m.usage_code_id
        JOIN public.org_fin_acct_mst a
          ON  a.id            = m.account_id
          AND a.tenant_org_id = m.tenant_org_id
        LEFT JOIN public.sys_fin_acc_type_cd at2
          ON at2.acc_type_id = a.acc_type_id
        LEFT JOIN public.sys_fin_acc_type_cd at_req
          ON at_req.acc_type_id = uc.primary_acc_type_id
        LEFT JOIN public.org_branches_mst b
          ON  b.id            = m.branch_id
          AND b.tenant_org_id = m.tenant_org_id
        WHERE m.tenant_org_id = ${tenantId}::uuid
          AND m.rec_status    = 1
        ORDER BY uc.is_required_v1 DESC, uc.usage_code, m.status_code
      `);

      return rows.map((r) => ({
        ...r,
        status_code: r.status_code as ErpLiteUsageMapRow['status_code'],
        mapping_issue: r.mapping_issue as ErpLiteUsageMapRow['mapping_issue'],
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        updated_at:
          r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
      }));
    });
  }

  // -------------------------------------------------------
  // Create a new usage map (status = DRAFT initially)
  // -------------------------------------------------------
  static async createUsageMap(input: CreateUsageMapInput): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.org_fin_usage_map_mst
          (tenant_org_id, branch_id, usage_code_id, account_id,
           status_code, effective_from, effective_to,
           created_at, created_by, rec_status, is_active)
        VALUES (
          ${tenantId}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.usage_code_id}::uuid,
          ${input.account_id}::uuid,
          'DRAFT',
          ${input.effective_from ?? null}::date,
          ${input.effective_to ?? null}::date,
          NOW(), ${auth.userId}, 1, true
        )
      `);
    });
  }

  // -------------------------------------------------------
  // Activate a DRAFT mapping
  // -------------------------------------------------------
  static async activateUsageMap(mappingId: string): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE public.org_fin_usage_map_mst
        SET status_code = 'ACTIVE',
            updated_at  = NOW(),
            updated_by  = ${auth.userId}
        WHERE id            = ${mappingId}::uuid
          AND tenant_org_id = ${tenantId}::uuid
          AND status_code   = 'DRAFT'
          AND rec_status    = 1
      `);
    });
  }

  // -------------------------------------------------------
  // Deactivate an ACTIVE mapping
  // -------------------------------------------------------
  static async deactivateUsageMap(mappingId: string): Promise<void> {
    const tenantId = await this.requireTenantId();
    const auth = await getAuthContext();

    return withTenantContext(tenantId, async () => {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE public.org_fin_usage_map_mst
        SET status_code = 'INACTIVE',
            is_active   = false,
            updated_at  = NOW(),
            updated_by  = ${auth.userId}
        WHERE id            = ${mappingId}::uuid
          AND tenant_org_id = ${tenantId}::uuid
          AND status_code   = 'ACTIVE'
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
