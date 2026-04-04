import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import type {
  CreateErpLiteAccountInput,
  ErpLiteCoaAccountListItem,
  ErpLiteCoaDashboardSnapshot,
  ErpLiteCoaOptionItem,
} from '@/lib/types/erp-lite-coa';

type LocalizedCatalogRow = {
  id: string;
  code: string | null;
  name: string | null;
  name2: string | null;
};

type ParentAccountRow = {
  id: string;
  account_code: string;
  account_level: number;
  is_postable: boolean;
  is_system_seeded: boolean;
  allow_tenant_children: boolean;
};

export class ErpLiteCoaService {
  static async getDashboardSnapshot(locale: 'en' | 'ar'): Promise<ErpLiteCoaDashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [accountList, accountTypeOptions, accountGroupOptions, parentAccountOptions, branchOptions] =
        await Promise.all([
          this.listAccounts(tenantId, locale),
          this.listAccountTypeOptions(locale),
          this.listAccountGroupOptions(locale),
          this.listParentAccountOptions(tenantId, locale),
          this.listBranchOptions(tenantId, locale),
        ]);

      return {
        account_list: accountList,
        account_type_options: accountTypeOptions,
        account_group_options: accountGroupOptions,
        parent_account_options: parentAccountOptions,
        branch_options: branchOptions,
      };
    });
  }

  static async createAccount(input: CreateErpLiteAccountInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const accountCode = input.account_code.trim();
      const accountName = input.name.trim();

      if (!accountCode) {
        throw new Error('Account code is required');
      }

      if (!accountName) {
        throw new Error('Account name is required');
      }

      const accountLevel = this.getAccountLevelFromCode(accountCode);
      const parentAccount = await this.assertValidParentAccount(
        tenantId,
        input.parent_account_id ?? null,
        accountCode,
        accountLevel
      );

      await this.assertValidAccountType(input.acc_type_id);
      await this.assertValidAccountGroup(input.acc_group_id ?? null, input.acc_type_id);
      await this.assertValidBranch(tenantId, input.branch_id ?? null);

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_acct_mst (
          tenant_org_id,
          parent_account_id,
          branch_id,
          acc_type_id,
          acc_group_id,
          account_code,
          account_level,
          name,
          name2,
          description,
          description2,
          is_postable,
          is_control_account,
          is_system_linked,
          manual_post_allowed,
          is_system_seeded,
          is_locked,
          allow_tenant_children,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.parent_account_id ?? null}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.acc_type_id}::uuid,
          ${input.acc_group_id ?? null}::uuid,
          ${accountCode},
          ${accountLevel},
          ${accountName},
          ${input.name2?.trim() || null},
          ${input.description?.trim() || null},
          ${input.description2?.trim() || null},
          ${input.is_postable ?? true},
          false,
          false,
          true,
          false,
          false,
          false,
          ${input.created_by ?? null},
          'ERP-Lite COA account create',
          1,
          true
        )
      `);
    });
  }

  private static async listAccounts(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteCoaAccountListItem[]> {
    const accountNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(a.name2, ''), a.name)`
        : Prisma.sql`a.name`;
    const typeNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(t.name2, ''), t.name)`
        : Prisma.sql`t.name`;
    const groupNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(g.name2, ''), g.name)`
        : Prisma.sql`g.name`;
    const parentNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(p.name2, ''), p.name)`
        : Prisma.sql`p.name`;
    const branchNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name)`
        : Prisma.sql`b.name`;

    return prisma.$queryRaw<ErpLiteCoaAccountListItem[]>(Prisma.sql`
      SELECT
        a.id::text AS id,
        a.account_code,
        ${accountNameSql} AS account_name,
        a.account_level,
        ${typeNameSql} AS account_type_name,
        ${groupNameSql} AS account_group_name,
        p.account_code AS parent_account_code,
        ${parentNameSql} AS parent_account_name,
        ${branchNameSql} AS branch_name,
        a.is_postable,
        a.is_control_account,
        a.is_system_linked,
        a.is_system_seeded,
        a.is_locked,
        a.manual_post_allowed,
        a.allow_tenant_children,
        a.is_active
      FROM public.org_fin_acct_mst a
      INNER JOIN public.sys_fin_acc_type_cd t
        ON t.acc_type_id = a.acc_type_id
      LEFT JOIN public.sys_fin_acc_group_cd g
        ON g.acc_group_id = a.acc_group_id
      LEFT JOIN public.org_fin_acct_mst p
        ON p.tenant_org_id = a.tenant_org_id
       AND p.id = a.parent_account_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = a.tenant_org_id
       AND b.id = a.branch_id
      WHERE a.tenant_org_id = ${tenantId}::uuid
        AND a.rec_status = 1
      ORDER BY a.account_code ASC
      LIMIT 200
    `);
  }

  private static async listAccountTypeOptions(locale: 'en' | 'ar'): Promise<ErpLiteCoaOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedCatalogRow[]>(Prisma.sql`
      SELECT
        acc_type_id::text AS id,
        acc_type_code AS code,
        name,
        name2
      FROM public.sys_fin_acc_type_cd
      WHERE is_active = true
        AND rec_status = 1
      ORDER BY COALESCE(rec_order, 999999), acc_type_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listAccountGroupOptions(locale: 'en' | 'ar'): Promise<ErpLiteCoaOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedCatalogRow[]>(Prisma.sql`
      SELECT
        acc_group_id::text AS id,
        acc_group_code AS code,
        name,
        name2
      FROM public.sys_fin_acc_group_cd
      WHERE is_active = true
        AND rec_status = 1
      ORDER BY COALESCE(rec_order, 999999), acc_group_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listParentAccountOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteCoaOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedCatalogRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        account_code AS code,
        name,
        name2
      FROM public.org_fin_acct_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
        AND is_postable = false
        AND (is_system_seeded = false OR allow_tenant_children = true)
      ORDER BY account_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listBranchOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteCoaOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedCatalogRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        id::text AS code,
        name,
        name2
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY COALESCE(rec_order, 999999), name ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async assertValidAccountType(accTypeId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT acc_type_id::text AS id
      FROM public.sys_fin_acc_type_cd
      WHERE acc_type_id = ${accTypeId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected account type is not available');
    }
  }

  private static async assertValidAccountGroup(
    accGroupId: string | null,
    accTypeId: string
  ): Promise<void> {
    if (!accGroupId) {
      return;
    }

    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT acc_group_id::text AS id
      FROM public.sys_fin_acc_group_cd
      WHERE acc_group_id = ${accGroupId}::uuid
        AND acc_type_id = ${accTypeId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected account group is not available for the selected account type');
    }
  }

  private static async assertValidParentAccount(
    tenantId: string,
    parentAccountId: string | null,
    accountCode: string,
    accountLevel: number
  ): Promise<ParentAccountRow | null> {
    if (!parentAccountId) {
      if (accountLevel !== 1) {
        throw new Error('Only level 1 accounts can be created without a parent account');
      }

      return null;
    }

    const rows = await prisma.$queryRaw<ParentAccountRow[]>(Prisma.sql`
      SELECT id::text AS id
           , account_code
           , account_level
           , is_postable
           , is_system_seeded
           , allow_tenant_children
      FROM public.org_fin_acct_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${parentAccountId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const parent = rows[0];

    if (!parent) {
      throw new Error('Selected parent account was not found for this tenant');
    }

    if (parent.is_postable) {
      throw new Error('Postable accounts cannot be used as parent accounts');
    }

    if (parent.is_system_seeded && !parent.allow_tenant_children) {
      throw new Error('Selected parent account is governed and does not allow tenant child accounts');
    }

    if (accountLevel !== parent.account_level + 1) {
      throw new Error('Child account depth must be exactly one level below its parent');
    }

    const expectedParentCode = this.getExpectedParentCode(accountCode, parent.account_level);
    if (parent.account_code !== expectedParentCode) {
      throw new Error('Account code does not match the selected parent hierarchy');
    }

    return parent;
  }

  private static async assertValidBranch(
    tenantId: string,
    branchId: string | null
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${branchId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected branch is not available for this tenant');
    }
  }

  private static mapLocalizedOptions(
    rows: LocalizedCatalogRow[],
    locale: 'en' | 'ar'
  ): ErpLiteCoaOptionItem[] {
    return rows.map((row) => {
      const localizedName =
        locale === 'ar'
          ? (row.name2?.trim() || row.name?.trim() || row.code || row.id)
          : (row.name?.trim() || row.name2?.trim() || row.code || row.id);

      return {
        id: row.id,
        label: row.code ? `${row.code} · ${localizedName}` : localizedName,
      };
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Tenant context is required for ERP-Lite chart of accounts');
    }
    return tenantId;
  }

  private static getAccountLevelFromCode(accountCode: string): number {
    const normalized = accountCode.trim();

    if (!/^\d{6}$/.test(normalized)) {
      throw new Error('Account code must be a 6-digit numeric code');
    }

    if (/^[1-9]00000$/.test(normalized)) {
      return 1;
    }

    if (/^[1-9]\d0000$/.test(normalized)) {
      return 2;
    }

    if (/^[1-9]\d\d000$/.test(normalized)) {
      return 3;
    }

    return 4;
  }

  private static getExpectedParentCode(accountCode: string, parentLevel: number): string {
    if (parentLevel === 1) {
      return `${accountCode.slice(0, 1)}00000`;
    }

    if (parentLevel === 2) {
      return `${accountCode.slice(0, 2)}0000`;
    }

    if (parentLevel === 3) {
      return `${accountCode.slice(0, 3)}000`;
    }

    throw new Error('Selected parent account is already at the deepest supported level');
  }
}
