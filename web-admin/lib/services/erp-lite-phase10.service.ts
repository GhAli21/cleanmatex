import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { ErpLiteReportingService, type ErpLiteReportLocale } from '@/lib/services/erp-lite-reporting.service';
import type {
  CreateErpLiteAllocationRuleInput,
  CreateErpLiteAllocationRunInput,
  CreateErpLiteAllocationRunLineInput,
  CreateErpLiteCostComponentInput,
  CreateErpLiteCostRunDetailInput,
  CreateErpLiteCostRunInput,
  ErpLiteAllocationRuleListItem,
  ErpLiteAllocationRunListItem,
  ErpLiteBranchProfitabilityAdvancedRow,
  ErpLiteCostComponentListItem,
  ErpLiteCostRunListItem,
  ErpLiteCostSummaryRow,
  ErpLitePhase10DashboardSnapshot,
} from '@/lib/types/erp-lite-phase10';

type OptionRow = {
  id: string;
  name: string | null;
  name2: string | null;
  code: string | null;
};

interface AllocationImpactRow {
  branch_id: string | null;
  branch_name: string;
  allocated_in: number;
  allocated_out: number;
  latest_run_no: string | null;
}

interface CostSummaryQueryRow {
  branch_id: string | null;
  branch_name: string;
  total_cost: number;
  latest_run_no: string | null;
}

interface CostSummaryResult {
  rows: ErpLiteCostSummaryRow[];
  latest_run_no: string | null;
}

export class ErpLitePhase10Service {
  static async getDashboardSnapshot(
    locale: ErpLiteReportLocale
  ): Promise<ErpLitePhase10DashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [
        directRows,
        allocationRows,
        allocationRules,
        allocationRuns,
        costComponents,
        costRuns,
        costSummaryRows,
        branchOptions,
      ] = await Promise.all([
        ErpLiteReportingService.getBranchProfitability(locale),
        this.getAllocationImpactRows(tenantId, locale),
        this.listAllocationRules(tenantId, locale),
        this.listAllocationRuns(tenantId),
        this.listCostComponents(tenantId, locale),
        this.listCostRuns(tenantId),
        this.listLatestCostSummaryRows(tenantId, locale),
        this.listBranchOptions(tenantId, locale),
      ]);

      const branchMap = new Map<string, ErpLiteBranchProfitabilityAdvancedRow>();

      for (const row of directRows) {
        branchMap.set(row.branch_id ?? '__unassigned__', {
          branch_id: row.branch_id,
          branch_name: row.branch_name,
          direct_revenue: row.direct_revenue,
          direct_expense: row.direct_expense,
          direct_profit: row.direct_profit,
          allocated_in: 0,
          allocated_out: 0,
          allocated_profit: row.direct_profit,
        });
      }

      for (const row of allocationRows) {
        const key = row.branch_id ?? '__unassigned__';
        const existing = branchMap.get(key) ?? {
          branch_id: row.branch_id,
          branch_name: row.branch_name,
          direct_revenue: 0,
          direct_expense: 0,
          direct_profit: 0,
          allocated_in: 0,
          allocated_out: 0,
          allocated_profit: 0,
        };
        existing.allocated_in = Number(row.allocated_in ?? 0);
        existing.allocated_out = Number(row.allocated_out ?? 0);
        existing.allocated_profit = this.roundAmount(
          existing.direct_profit + existing.allocated_in - existing.allocated_out
        );
        branchMap.set(key, existing);
      }

      const profitabilityRows = Array.from(branchMap.values()).sort((a, b) =>
        a.branch_name.localeCompare(b.branch_name)
      );

      return {
        profitability_rows: profitabilityRows,
        allocation_rules: allocationRules,
        allocation_runs: allocationRuns,
        cost_components: costComponents,
        cost_runs: costRuns,
        cost_summary_rows: costSummaryRows.rows,
        branch_options: branchOptions.map((item) => ({ id: item.id, label: this.localize(item, locale) })),
        allocation_rule_options: allocationRules.map((item) => ({
          id: item.id,
          label: `${item.rule_code} · ${item.rule_name}`,
        })),
        allocation_run_options: allocationRuns.map((item) => ({
          id: item.id,
          label: `${item.run_no} · ${item.status_code}`,
        })),
        cost_component_options: costComponents.map((item) => ({
          id: item.id,
          label: `${item.comp_code} · ${item.component_name}`,
        })),
        cost_run_options: costRuns.map((item) => ({
          id: item.id,
          label: `${item.run_no} · ${item.status_code}`,
        })),
        latest_alloc_run_no: allocationRows[0]?.latest_run_no ?? null,
        latest_cost_run_no: costSummaryRows.latest_run_no,
      };
    });
  }

  static async createAllocationRule(input: CreateErpLiteAllocationRuleInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const ruleCode =
        input.rule_code?.trim() ||
        (await this.generateSequentialNo(tenantId, 'ALR', 'rule_code', 'org_fin_alloc_rule_mst'));

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_alloc_rule_mst (
          tenant_org_id,
          rule_code,
          name,
          name2,
          alloc_scope_code,
          basis_code,
          status_code,
          effective_from,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${ruleCode},
          ${input.name},
          ${input.name2 ?? null},
          'BRANCH_PL',
          ${input.basis_code},
          'ACTIVE',
          ${input.effective_from ?? null}::date,
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 allocation rule create',
          1,
          true
        )
      `);
    });
  }

  static async createAllocationRun(input: CreateErpLiteAllocationRunInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const runNo = await this.generateSequentialNo(
        tenantId,
        'APR',
        'run_no',
        'org_fin_alloc_run_mst'
      );

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_alloc_run_mst (
          tenant_org_id,
          run_no,
          alloc_scope_code,
          run_date,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${runNo},
          'BRANCH_PL',
          ${input.run_date}::date,
          'DRAFT',
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 allocation run create',
          1,
          true
        )
      `);
    });
  }

  static async addAllocationRunLine(input: CreateErpLiteAllocationRunLineInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      this.assertNonNegativeAmount(input.source_amount, 'source_amount');
      this.assertPositiveAmount(input.alloc_amount, 'alloc_amount');
      await this.assertDraftAllocationRun(tenantId, input.alloc_run_id);
      await this.assertValidBranch(tenantId, input.target_branch_id);
      await this.assertValidBranch(tenantId, input.source_branch_id ?? null);
      if (input.alloc_rule_id) {
        await this.assertAllocationRule(tenantId, input.alloc_rule_id);
      }

      const lineRows = await prisma.$queryRaw<{ next_line_no: number }[]>(Prisma.sql`
        SELECT COALESCE(MAX(line_no), 0)::int + 1 AS next_line_no
        FROM public.org_fin_alloc_run_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND alloc_run_id = ${input.alloc_run_id}::uuid
      `);

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_alloc_run_dtl (
          tenant_org_id,
          alloc_run_id,
          line_no,
          alloc_rule_id,
          source_branch_id,
          target_branch_id,
          source_amount,
          alloc_amount,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.alloc_run_id}::uuid,
          ${lineRows[0]?.next_line_no ?? 1},
          ${input.alloc_rule_id ?? null}::uuid,
          ${input.source_branch_id ?? null}::uuid,
          ${input.target_branch_id}::uuid,
          ${this.roundAmount(input.source_amount)},
          ${this.roundAmount(input.alloc_amount)},
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 allocation run line create',
          1,
          true
        )
      `);
    });
  }

  static async postAllocationRun(allocRunId: string, postedBy?: string | null): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const countRows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM public.org_fin_alloc_run_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND alloc_run_id = ${allocRunId}::uuid
          AND is_active = true
          AND rec_status = 1
      `);

      if ((countRows[0]?.count ?? 0) === 0) {
        throw new Error('Allocation run must contain at least one detail line before posting');
      }

      await prisma.$queryRaw(Prisma.sql`
        UPDATE public.org_fin_alloc_run_mst
        SET
          status_code = 'POSTED',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${postedBy ?? null},
          updated_info = 'ERP-Lite Phase 10 allocation run post'
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${allocRunId}::uuid
          AND status_code = 'DRAFT'
      `);
    });
  }

  static async createCostComponent(input: CreateErpLiteCostComponentInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const compCode =
        input.comp_code?.trim() ||
        (await this.generateSequentialNo(tenantId, 'CMP', 'comp_code', 'org_fin_cost_cmp_cd'));

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_cost_cmp_cd (
          tenant_org_id,
          comp_code,
          name,
          name2,
          cost_class_code,
          basis_code,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${compCode},
          ${input.name},
          ${input.name2 ?? null},
          ${input.cost_class_code},
          ${input.basis_code},
          'ACTIVE',
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 cost component create',
          1,
          true
        )
      `);
    });
  }

  static async createCostRun(input: CreateErpLiteCostRunInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const runNo = await this.generateSequentialNo(
        tenantId,
        'CRN',
        'run_no',
        'org_fin_cost_run_mst'
      );

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_cost_run_mst (
          tenant_org_id,
          run_no,
          run_date,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${runNo},
          ${input.run_date}::date,
          'DRAFT',
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 cost run create',
          1,
          true
        )
      `);
    });
  }

  static async addCostRunDetail(input: CreateErpLiteCostRunDetailInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      this.assertNonNegativeAmount(input.alloc_amount, 'alloc_amount');
      this.assertPositiveAmount(input.total_cost, 'total_cost');
      if (input.unit_cost != null) {
        this.assertNonNegativeAmount(input.unit_cost, 'unit_cost');
      }
      if (input.basis_value != null) {
        this.assertNonNegativeAmount(input.basis_value, 'basis_value');
      }

      await this.assertDraftCostRun(tenantId, input.cost_run_id);
      await this.assertCostComponent(tenantId, input.cost_comp_id);
      await this.assertValidBranch(tenantId, input.branch_id ?? null);

      const lineRows = await prisma.$queryRaw<{ next_line_no: number }[]>(Prisma.sql`
        SELECT COALESCE(MAX(line_no), 0)::int + 1 AS next_line_no
        FROM public.org_fin_cost_run_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND cost_run_id = ${input.cost_run_id}::uuid
      `);

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_cost_run_dtl (
          tenant_org_id,
          cost_run_id,
          line_no,
          cost_comp_id,
          branch_id,
          basis_value,
          alloc_amount,
          unit_cost,
          total_cost,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.cost_run_id}::uuid,
          ${lineRows[0]?.next_line_no ?? 1},
          ${input.cost_comp_id}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.basis_value ?? null},
          ${this.roundAmount(input.alloc_amount)},
          ${input.unit_cost ?? null},
          ${this.roundAmount(input.total_cost)},
          ${input.created_by ?? null},
          'ERP-Lite Phase 10 cost run detail create',
          1,
          true
        )
      `);
    });
  }

  static async postCostRun(costRunId: string, postedBy?: string | null): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const countRows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM public.org_fin_cost_run_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND cost_run_id = ${costRunId}::uuid
          AND is_active = true
          AND rec_status = 1
      `);

      if ((countRows[0]?.count ?? 0) === 0) {
        throw new Error('Cost run must contain at least one detail line before posting');
      }

      await prisma.$queryRaw(Prisma.sql`
        UPDATE public.org_fin_cost_run_mst
        SET
          status_code = 'POSTED',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${postedBy ?? null},
          updated_info = 'ERP-Lite Phase 10 cost run post'
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${costRunId}::uuid
          AND status_code = 'DRAFT'
      `);
    });
  }

  private static async getAllocationImpactRows(
    tenantId: string,
    locale: ErpLiteReportLocale
  ): Promise<AllocationImpactRow[]> {
    const branchNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name, 'Unassigned')`
        : Prisma.sql`COALESCE(b.name, 'Unassigned')`;

    return prisma.$queryRaw<AllocationImpactRow[]>(Prisma.sql`
      WITH latest_run AS (
        SELECT id, run_no
        FROM public.org_fin_alloc_run_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND alloc_scope_code = 'BRANCH_PL'
          AND status_code = 'POSTED'
          AND is_active = true
          AND rec_status = 1
        ORDER BY run_date DESC, created_at DESC
        LIMIT 1
      ),
      alloc_rows AS (
        SELECT
          d.target_branch_id AS branch_id,
          d.alloc_amount::float8 AS allocated_in,
          0::float8 AS allocated_out
        FROM public.org_fin_alloc_run_dtl d
        INNER JOIN latest_run r
          ON r.id = d.alloc_run_id
        WHERE d.tenant_org_id = ${tenantId}::uuid
          AND d.is_active = true
          AND d.rec_status = 1
        UNION ALL
        SELECT
          d.source_branch_id AS branch_id,
          0::float8 AS allocated_in,
          d.alloc_amount::float8 AS allocated_out
        FROM public.org_fin_alloc_run_dtl d
        INNER JOIN latest_run r
          ON r.id = d.alloc_run_id
        WHERE d.tenant_org_id = ${tenantId}::uuid
          AND d.source_branch_id IS NOT NULL
          AND d.is_active = true
          AND d.rec_status = 1
      )
      SELECT
        a.branch_id::text AS branch_id,
        ${branchNameSql} AS branch_name,
        COALESCE(SUM(a.allocated_in), 0)::float8 AS allocated_in,
        COALESCE(SUM(a.allocated_out), 0)::float8 AS allocated_out,
        (SELECT run_no FROM latest_run LIMIT 1) AS latest_run_no
      FROM alloc_rows a
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = ${tenantId}::uuid
       AND b.id = a.branch_id
      GROUP BY a.branch_id, ${branchNameSql}
      ORDER BY branch_name ASC
    `);
  }

  private static async listAllocationRules(
    tenantId: string,
    locale: ErpLiteReportLocale
  ): Promise<ErpLiteAllocationRuleListItem[]> {
    const ruleNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(name2, ''), name)`
        : Prisma.sql`name`;

    return prisma.$queryRaw<ErpLiteAllocationRuleListItem[]>(Prisma.sql`
      SELECT
        id::text AS id,
        rule_code,
        ${ruleNameSql} AS rule_name,
        basis_code,
        status_code,
        TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from
      FROM public.org_fin_alloc_rule_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND alloc_scope_code = 'BRANCH_PL'
        AND is_active = true
        AND rec_status = 1
      ORDER BY status_code ASC, rule_code ASC
      LIMIT 12
    `);
  }

  private static async listAllocationRuns(tenantId: string): Promise<ErpLiteAllocationRunListItem[]> {
    return prisma.$queryRaw<ErpLiteAllocationRunListItem[]>(Prisma.sql`
      SELECT
        r.id::text AS id,
        r.run_no,
        TO_CHAR(r.run_date, 'YYYY-MM-DD') AS run_date,
        r.status_code,
        COUNT(d.id)::int AS line_count
      FROM public.org_fin_alloc_run_mst r
      LEFT JOIN public.org_fin_alloc_run_dtl d
        ON d.alloc_run_id = r.id
       AND d.tenant_org_id = r.tenant_org_id
       AND d.is_active = true
       AND d.rec_status = 1
      WHERE r.tenant_org_id = ${tenantId}::uuid
        AND r.alloc_scope_code = 'BRANCH_PL'
        AND r.is_active = true
        AND r.rec_status = 1
      GROUP BY r.id, r.run_no, r.run_date, r.status_code
      ORDER BY r.run_date DESC, r.created_at DESC
      LIMIT 12
    `);
  }

  private static async listCostComponents(
    tenantId: string,
    locale: ErpLiteReportLocale
  ): Promise<ErpLiteCostComponentListItem[]> {
    const compNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(name2, ''), name)`
        : Prisma.sql`name`;

    return prisma.$queryRaw<ErpLiteCostComponentListItem[]>(Prisma.sql`
      SELECT
        id::text AS id,
        comp_code,
        ${compNameSql} AS component_name,
        cost_class_code,
        basis_code,
        status_code
      FROM public.org_fin_cost_cmp_cd
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY comp_code ASC
      LIMIT 12
    `);
  }

  private static async listCostRuns(tenantId: string): Promise<ErpLiteCostRunListItem[]> {
    const rows = await prisma.$queryRaw<ErpLiteCostRunListItem[]>(Prisma.sql`
      SELECT
        r.id::text AS id,
        r.run_no,
        TO_CHAR(r.run_date, 'YYYY-MM-DD') AS run_date,
        r.status_code,
        COUNT(d.id)::int AS line_count,
        COALESCE(SUM(d.total_cost), 0)::float8 AS total_cost
      FROM public.org_fin_cost_run_mst r
      LEFT JOIN public.org_fin_cost_run_dtl d
        ON d.cost_run_id = r.id
       AND d.tenant_org_id = r.tenant_org_id
       AND d.is_active = true
       AND d.rec_status = 1
      WHERE r.tenant_org_id = ${tenantId}::uuid
        AND r.is_active = true
        AND r.rec_status = 1
      GROUP BY r.id, r.run_no, r.run_date, r.status_code
      ORDER BY r.run_date DESC, r.created_at DESC
      LIMIT 12
    `);

    return rows.map((row) => ({
      ...row,
      total_cost: Number(row.total_cost ?? 0),
    }));
  }

  private static async listLatestCostSummaryRows(
    tenantId: string,
    locale: ErpLiteReportLocale
  ): Promise<CostSummaryResult> {
    const branchNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name, 'Unassigned')`
        : Prisma.sql`COALESCE(b.name, 'Unassigned')`;

    const rows = await prisma.$queryRaw<CostSummaryQueryRow[]>(Prisma.sql`
      WITH latest_run AS (
        SELECT id, run_no
        FROM public.org_fin_cost_run_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND status_code = 'POSTED'
          AND is_active = true
          AND rec_status = 1
        ORDER BY run_date DESC, created_at DESC
        LIMIT 1
      )
      SELECT
        d.branch_id::text AS branch_id,
        ${branchNameSql} AS branch_name,
        COALESCE(SUM(d.total_cost), 0)::float8 AS total_cost,
        (SELECT run_no FROM latest_run LIMIT 1) AS latest_run_no
      FROM public.org_fin_cost_run_dtl d
      INNER JOIN latest_run r
        ON r.id = d.cost_run_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = ${tenantId}::uuid
       AND b.id = d.branch_id
      WHERE d.tenant_org_id = ${tenantId}::uuid
        AND d.is_active = true
        AND d.rec_status = 1
      GROUP BY d.branch_id, ${branchNameSql}
      ORDER BY branch_name ASC
    `);

    return {
      rows: rows.map((row) => ({
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        total_cost: Number(row.total_cost ?? 0),
      })),
      latest_run_no: rows[0]?.latest_run_no ?? null,
    };
  }

  private static async listBranchOptions(tenantId: string, locale: ErpLiteReportLocale): Promise<OptionRow[]> {
    return prisma.$queryRaw<OptionRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        name,
        name2,
        id::text AS code
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY name ASC
    `);
  }

  private static async assertDraftAllocationRun(tenantId: string, allocRunId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_alloc_run_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${allocRunId}::uuid
        AND alloc_scope_code = 'BRANCH_PL'
        AND status_code = 'DRAFT'
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected allocation run is not an active draft for this tenant');
    }
  }

  private static async assertDraftCostRun(tenantId: string, costRunId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_cost_run_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${costRunId}::uuid
        AND status_code = 'DRAFT'
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected cost run is not an active draft for this tenant');
    }
  }

  private static async assertAllocationRule(tenantId: string, allocRuleId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_alloc_rule_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${allocRuleId}::uuid
        AND alloc_scope_code = 'BRANCH_PL'
        AND status_code = 'ACTIVE'
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected allocation rule is not active for this tenant');
    }
  }

  private static async assertCostComponent(tenantId: string, costCompId: string): Promise<void> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_cost_cmp_cd
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${costCompId}::uuid
        AND status_code = 'ACTIVE'
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected cost component is not active for this tenant');
    }
  }

  private static async assertValidBranch(tenantId: string, branchId: string | null): Promise<void> {
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

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }
    return tenantId;
  }

  private static async generateSequentialNo(
    tenantId: string,
    prefix: string,
    columnName: string,
    tableName: string
  ): Promise<string> {
    const periodToken = new Date().toISOString().slice(0, 7).replace('-', '');
    const likePattern = `${prefix}-${periodToken}%`;
    const rows = await prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql([
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_org_id = `,
        `::uuid AND ${columnName} LIKE `,
        ``,
      ] as unknown as TemplateStringsArray, tenantId, likePattern)
    );
    const nextNo = String((rows[0]?.count ?? 0) + 1).padStart(5, '0');
    return `${prefix}-${periodToken}-${nextNo}`;
  }

  private static localize(row: OptionRow, locale: ErpLiteReportLocale): string {
    const name =
      locale === 'ar'
        ? row.name2?.trim() || row.name?.trim() || row.code?.trim() || row.id
        : row.name?.trim() || row.name2?.trim() || row.code?.trim() || row.id;

    return row.code ? `${row.code} · ${name}` : name;
  }

  private static assertPositiveAmount(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Field ${field} must be greater than zero`);
    }
  }

  private static assertNonNegativeAmount(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Field ${field} must be zero or greater`);
    }
  }

  private static roundAmount(value: number): number {
    return Number(value.toFixed(4));
  }
}
