import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { assertErpLiteEnabledForTenant } from '@/lib/services/erp-lite-feature-guard';

export type ErpLiteReportLocale = 'en' | 'ar';

export interface ErpLiteGlInquiryRow {
  journal_id: string;
  journal_no: string;
  posting_date: string;
  txn_event_code: string;
  source_doc_type_code: string;
  source_doc_no: string | null;
  line_no: number;
  account_code: string;
  account_name: string;
  entry_side: string;
  amount_txn_currency: number;
  currency_code: string;
  /** Total rows across all pages (for pagination). */
  total_count: number;
}

export interface ErpLiteGlInquiryFilters {
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;     // YYYY-MM-DD
  eventCode?: string;
  accountCode?: string;
  entrySide?: 'DEBIT' | 'CREDIT';
  journalNo?: string;
  page?: number;
  pageSize?: number;
}

export interface ErpLiteGlSummary {
  totalDebit: number;
  totalCredit: number;
  rowCount: number;
}

export interface ErpLiteGlJournalDetail {
  journal_id: string;
  journal_no: string;
  journal_date: string;
  posting_date: string;
  txn_event_code: string;
  source_module_code: string;
  source_doc_type_code: string;
  source_doc_no: string | null;
  currency_code: string;
  exchange_rate: number;
  total_debit: number;
  total_credit: number;
  status_code: string;
  narration: string | null;
  posted_at: string | null;
  posted_by: string | null;
  lines: ErpLiteGlJournalLine[];
}

export interface ErpLiteGlJournalLine {
  line_no: number;
  account_code: string;
  account_name: string;
  entry_side: string;
  amount_txn_currency: number;
  amount_base_currency: number;
  cost_center_id: string | null;
  profit_center_id: string | null;
}

export interface ErpLiteTrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export interface ErpLiteStatementRow {
  section_code: string;
  account_type_code: string;
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
}

export interface ErpLiteArAgingRow {
  customer_id: string;
  customer_name: string;
  invoice_id: string;
  invoice_no: string;
  invoice_date: string | null;
  due_date: string | null;
  days_overdue: number;
  outstanding_amount: number;
  bucket_code: 'CURRENT' | 'DUE_1_30' | 'DUE_31_60' | 'DUE_61_90' | 'DUE_91_PLUS';
  currency_code: string | null;
}

export interface ErpLiteBranchProfitabilityRow {
  branch_id: string | null;
  branch_name: string;
  direct_revenue: number;
  direct_expense: number;
  direct_profit: number;
}

export class ErpLiteReportingService {
  static async getGlInquiry(
    filters: ErpLiteGlInquiryFilters = {},
    locale: ErpLiteReportLocale = 'en',
  ): Promise<{ rows: ErpLiteGlInquiryRow[]; total: number }> {
    const tenantId = await this.requireTenantId();
    const accountNameSql = this.accountNameSql(locale);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(10, filters.pageSize ?? 50), 200);
    const offset = (page - 1) * pageSize;

    // Build optional filter fragments
    const dateFromClause = filters.dateFrom
      ? Prisma.sql`AND j.posting_date >= ${filters.dateFrom}::date`
      : Prisma.sql``;
    const dateToClause = filters.dateTo
      ? Prisma.sql`AND j.posting_date <= ${filters.dateTo}::date`
      : Prisma.sql``;
    const eventClause = filters.eventCode
      ? Prisma.sql`AND j.txn_event_code = ${filters.eventCode}`
      : Prisma.sql``;
    const accountClause = filters.accountCode
      ? Prisma.sql`AND a.account_code ILIKE ${'%' + filters.accountCode + '%'}`
      : Prisma.sql``;
    const sideClause = filters.entrySide
      ? Prisma.sql`AND d.entry_side = ${filters.entrySide}`
      : Prisma.sql``;
    const journalNoClause = filters.journalNo
      ? Prisma.sql`AND j.journal_no ILIKE ${'%' + filters.journalNo + '%'}`
      : Prisma.sql``;

    return withTenantContext(tenantId, async () => {
      type GlRawRow = ErpLiteGlInquiryRow & { total_count: string }
      const rows = await prisma.$queryRaw<GlRawRow[]>(Prisma.sql`
        SELECT
          j.id AS journal_id,
          j.journal_no,
          TO_CHAR(j.posting_date, 'YYYY-MM-DD') AS posting_date,
          j.txn_event_code,
          j.source_doc_type_code,
          j.source_doc_no,
          d.line_no,
          a.account_code,
          ${accountNameSql} AS account_name,
          d.entry_side,
          d.amount_txn_currency,
          j.currency_code,
          COUNT(*) OVER () AS total_count
        FROM public.org_fin_journal_mst j
        INNER JOIN public.org_fin_journal_dtl d
          ON d.journal_id = j.id
         AND d.tenant_org_id = j.tenant_org_id
        INNER JOIN public.org_fin_acct_mst a
          ON a.id = d.account_id
         AND a.tenant_org_id = d.tenant_org_id
        WHERE j.tenant_org_id = ${tenantId}::uuid
          AND j.status_code = 'POSTED'
          AND j.is_active = true
          AND j.rec_status = 1
          AND d.is_active = true
          AND d.rec_status = 1
          ${dateFromClause}
          ${dateToClause}
          ${eventClause}
          ${accountClause}
          ${sideClause}
          ${journalNoClause}
        ORDER BY j.posting_date DESC, j.created_at DESC, d.line_no ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
      return {
        rows: rows.map((row) => ({
          ...row,
          amount_txn_currency: Number(row.amount_txn_currency ?? 0),
          total_count: Number(row.total_count ?? 0),
        })),
        total,
      };
    });
  }

  static async getGlSummary(
    filters: Omit<ErpLiteGlInquiryFilters, 'page' | 'pageSize'> = {},
    locale: ErpLiteReportLocale = 'en',
  ): Promise<ErpLiteGlSummary> {
    const tenantId = await this.requireTenantId();

    const dateFromClause = filters.dateFrom
      ? Prisma.sql`AND j.posting_date >= ${filters.dateFrom}::date`
      : Prisma.sql``;
    const dateToClause = filters.dateTo
      ? Prisma.sql`AND j.posting_date <= ${filters.dateTo}::date`
      : Prisma.sql``;
    const eventClause = filters.eventCode
      ? Prisma.sql`AND j.txn_event_code = ${filters.eventCode}`
      : Prisma.sql``;
    const accountClause = filters.accountCode
      ? Prisma.sql`AND a.account_code ILIKE ${'%' + filters.accountCode + '%'}`
      : Prisma.sql``;
    const sideClause = filters.entrySide
      ? Prisma.sql`AND d.entry_side = ${filters.entrySide}`
      : Prisma.sql``;
    const journalNoClause = filters.journalNo
      ? Prisma.sql`AND j.journal_no ILIKE ${'%' + filters.journalNo + '%'}`
      : Prisma.sql``;

    return withTenantContext(tenantId, async () => {
      const [summary] = await prisma.$queryRaw<
        [{ total_debit: string; total_credit: string; row_count: string }]
      >(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN d.entry_side = 'DEBIT' THEN d.amount_txn_currency ELSE 0 END), 0) AS total_debit,
          COALESCE(SUM(CASE WHEN d.entry_side = 'CREDIT' THEN d.amount_txn_currency ELSE 0 END), 0) AS total_credit,
          COUNT(*) AS row_count
        FROM public.org_fin_journal_mst j
        INNER JOIN public.org_fin_journal_dtl d
          ON d.journal_id = j.id
         AND d.tenant_org_id = j.tenant_org_id
        INNER JOIN public.org_fin_acct_mst a
          ON a.id = d.account_id
         AND a.tenant_org_id = d.tenant_org_id
        WHERE j.tenant_org_id = ${tenantId}::uuid
          AND j.status_code = 'POSTED'
          AND j.is_active = true
          AND j.rec_status = 1
          AND d.is_active = true
          AND d.rec_status = 1
          ${dateFromClause}
          ${dateToClause}
          ${eventClause}
          ${accountClause}
          ${sideClause}
          ${journalNoClause}
      `);

      return {
        totalDebit: Number(summary?.total_debit ?? 0),
        totalCredit: Number(summary?.total_credit ?? 0),
        rowCount: Number(summary?.row_count ?? 0),
      };
    });
  }

  static async getGlJournalDetail(
    journalId: string,
    locale: ErpLiteReportLocale = 'en',
  ): Promise<ErpLiteGlJournalDetail | null> {
    const tenantId = await this.requireTenantId();
    const accountNameSql = this.accountNameSql(locale);

    return withTenantContext(tenantId, async () => {
      const [header] = await prisma.$queryRaw<
        [{
          journal_id: string;
          journal_no: string;
          journal_date: string;
          posting_date: string;
          txn_event_code: string;
          source_module_code: string;
          source_doc_type_code: string;
          source_doc_no: string | null;
          currency_code: string;
          exchange_rate: string;
          total_debit: string;
          total_credit: string;
          status_code: string;
          narration: string | null;
          posted_at: string | null;
          posted_by: string | null;
        }]
      >(Prisma.sql`
        SELECT
          id AS journal_id,
          journal_no,
          TO_CHAR(journal_date, 'YYYY-MM-DD') AS journal_date,
          TO_CHAR(posting_date, 'YYYY-MM-DD') AS posting_date,
          txn_event_code,
          source_module_code,
          source_doc_type_code,
          source_doc_no,
          currency_code,
          exchange_rate,
          total_debit,
          total_credit,
          status_code,
          narration,
          TO_CHAR(posted_at, 'YYYY-MM-DD HH24:MI') AS posted_at,
          posted_by
        FROM public.org_fin_journal_mst
        WHERE id = ${journalId}::uuid
          AND tenant_org_id = ${tenantId}::uuid
          AND is_active = true
          AND rec_status = 1
        LIMIT 1
      `);

      if (!header) return null;

      const lines = await prisma.$queryRaw<ErpLiteGlJournalLine[]>(Prisma.sql`
        SELECT
          d.line_no,
          a.account_code,
          ${accountNameSql} AS account_name,
          d.entry_side,
          d.amount_txn_currency,
          d.amount_base_currency,
          d.cost_center_id::text,
          d.profit_center_id::text
        FROM public.org_fin_journal_dtl d
        INNER JOIN public.org_fin_acct_mst a
          ON a.id = d.account_id
         AND a.tenant_org_id = d.tenant_org_id
        WHERE d.journal_id = ${journalId}::uuid
          AND d.tenant_org_id = ${tenantId}::uuid
          AND d.is_active = true
          AND d.rec_status = 1
        ORDER BY d.line_no ASC
      `);

      return {
        ...header,
        exchange_rate: Number(header.exchange_rate ?? 1),
        total_debit: Number(header.total_debit ?? 0),
        total_credit: Number(header.total_credit ?? 0),
        lines: lines.map((l) => ({
          ...l,
          amount_txn_currency: Number(l.amount_txn_currency ?? 0),
          amount_base_currency: Number(l.amount_base_currency ?? 0),
        })),
      };
    });
  }

  static async getGlDistinctEventCodes(locale: ErpLiteReportLocale = 'en'): Promise<string[]> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<[{ txn_event_code: string }]>(Prisma.sql`
        SELECT DISTINCT txn_event_code
        FROM public.org_fin_journal_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND status_code = 'POSTED'
          AND is_active = true
          AND rec_status = 1
        ORDER BY txn_event_code ASC
      `);
      return (rows as { txn_event_code: string }[]).map((r) => r.txn_event_code);
    });
  }

  static async getTrialBalance(locale: ErpLiteReportLocale = 'en'): Promise<ErpLiteTrialBalanceRow[]> {
    const tenantId = await this.requireTenantId();
    const accountNameSql = this.accountNameSql(locale);

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<ErpLiteTrialBalanceRow[]>(Prisma.sql`
        SELECT
          a.id AS account_id,
          a.account_code,
          ${accountNameSql} AS account_name,
          COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND d.entry_side = 'DEBIT' THEN d.amount_base_currency ELSE 0 END), 0) AS total_debit,
          COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND d.entry_side = 'CREDIT' THEN d.amount_base_currency ELSE 0 END), 0) AS total_credit,
          COALESCE(SUM(
            CASE
              WHEN j.id IS NULL THEN 0
              WHEN d.entry_side = 'DEBIT' THEN d.amount_base_currency
              ELSE -d.amount_base_currency
            END
          ), 0) AS balance
        FROM public.org_fin_acct_mst a
        LEFT JOIN public.org_fin_journal_dtl d
          ON d.account_id = a.id
         AND d.tenant_org_id = a.tenant_org_id
         AND d.is_active = true
         AND d.rec_status = 1
        LEFT JOIN public.org_fin_journal_mst j
          ON j.id = d.journal_id
         AND j.tenant_org_id = d.tenant_org_id
         AND j.status_code = 'POSTED'
         AND j.is_active = true
         AND j.rec_status = 1
        WHERE a.tenant_org_id = ${tenantId}::uuid
          AND a.is_active = true
          AND a.rec_status = 1
          AND a.is_postable = true
        GROUP BY a.id, a.account_code, a.name
        HAVING COALESCE(SUM(CASE WHEN j.id IS NOT NULL THEN d.amount_base_currency ELSE 0 END), 0) <> 0
            OR COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND d.entry_side = 'DEBIT' THEN d.amount_base_currency ELSE 0 END), 0) <> 0
            OR COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND d.entry_side = 'CREDIT' THEN d.amount_base_currency ELSE 0 END), 0) <> 0
        ORDER BY a.account_code ASC
      `);

      return rows.map((row) => ({
        ...row,
        total_debit: Number(row.total_debit ?? 0),
        total_credit: Number(row.total_credit ?? 0),
        balance: Number(row.balance ?? 0),
      }));
    });
  }

  static async getProfitAndLoss(locale: ErpLiteReportLocale = 'en'): Promise<ErpLiteStatementRow[]> {
    return this.getStatementRows('PROFIT_LOSS', locale);
  }

  static async getBalanceSheet(locale: ErpLiteReportLocale = 'en'): Promise<ErpLiteStatementRow[]> {
    return this.getStatementRows('BALANCE_SHEET', locale);
  }

  static async getArAging(locale: ErpLiteReportLocale = 'en'): Promise<ErpLiteArAgingRow[]> {
    const tenantId = await this.requireTenantId();
    const customerNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(c.name2, ''), c.name, inv.invoice_no)`
        : Prisma.sql`COALESCE(c.name, inv.invoice_no)`;

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<ErpLiteArAgingRow[]>(Prisma.sql`
        SELECT
          inv.customer_id,
          ${customerNameSql} AS customer_name,
          inv.id AS invoice_id,
          inv.invoice_no,
          TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') AS invoice_date,
          TO_CHAR(inv.due_date, 'YYYY-MM-DD') AS due_date,
          GREATEST(CURRENT_DATE - COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE), 0) AS days_overdue,
          GREATEST(COALESCE(inv.total, 0) - COALESCE(inv.paid_amount, 0), 0) AS outstanding_amount,
          CASE
            WHEN COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE) >= CURRENT_DATE THEN 'CURRENT'
            WHEN CURRENT_DATE - COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE) BETWEEN 1 AND 30 THEN 'DUE_1_30'
            WHEN CURRENT_DATE - COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE) BETWEEN 31 AND 60 THEN 'DUE_31_60'
            WHEN CURRENT_DATE - COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE) BETWEEN 61 AND 90 THEN 'DUE_61_90'
            ELSE 'DUE_91_PLUS'
          END AS bucket_code,
          inv.currency_code
        FROM public.org_invoice_mst inv
        LEFT JOIN public.org_customers_mst c
          ON c.id = inv.customer_id
         AND c.tenant_org_id = inv.tenant_org_id
         AND c.is_active = true
         AND c.rec_status = 1
        WHERE inv.tenant_org_id = ${tenantId}::uuid
          AND inv.is_active = true
          AND inv.rec_status = 1
          AND inv.customer_id IS NOT NULL
          AND COALESCE(inv.total, 0) > COALESCE(inv.paid_amount, 0)
          AND COALESCE(inv.status, 'pending') <> 'cancelled'
          AND EXISTS (
            SELECT 1
            FROM public.org_fin_post_log_tr log
            WHERE log.tenant_org_id = inv.tenant_org_id
              AND log.source_doc_type_code = 'INVOICE'
              AND log.source_doc_id = inv.id::uuid
              AND log.txn_event_code = 'ORDER_INVOICED'
              AND log.attempt_status_code = 'POSTED'
              AND log.log_status_code = 'POSTED'
              AND log.is_active = true
              AND log.rec_status = 1
          )
        ORDER BY
          customer_name ASC,
          COALESCE(inv.due_date, inv.invoice_date, CURRENT_DATE) ASC,
          inv.invoice_no ASC
      `);

      return rows.map((row) => ({
        ...row,
        days_overdue: Number(row.days_overdue ?? 0),
        outstanding_amount: Number(row.outstanding_amount ?? 0),
      }));
    });
  }

  static async getBranchProfitability(
    locale: ErpLiteReportLocale = 'en'
  ): Promise<ErpLiteBranchProfitabilityRow[]> {
    const tenantId = await this.requireTenantId();
    const branchNameSql =
      locale === 'ar'
        ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name, 'Unassigned')`
        : Prisma.sql`COALESCE(b.name, 'Unassigned')`;

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<ErpLiteBranchProfitabilityRow[]>(Prisma.sql`
        SELECT
          COALESCE(d.branch_id, j.branch_id)::text AS branch_id,
          ${branchNameSql} AS branch_name,
          COALESCE(SUM(
            CASE
              WHEN t.acc_type_code = 'REVENUE' AND d.entry_side = 'CREDIT' THEN d.amount_base_currency
              WHEN t.acc_type_code = 'REVENUE' AND d.entry_side = 'DEBIT' THEN -d.amount_base_currency
              ELSE 0
            END
          ), 0) AS direct_revenue,
          COALESCE(SUM(
            CASE
              WHEN t.acc_type_code = 'EXPENSE' AND d.entry_side = 'DEBIT' THEN d.amount_base_currency
              WHEN t.acc_type_code = 'EXPENSE' AND d.entry_side = 'CREDIT' THEN -d.amount_base_currency
              ELSE 0
            END
          ), 0) AS direct_expense,
          COALESCE(SUM(
            CASE
              WHEN t.acc_type_code = 'REVENUE' AND d.entry_side = 'CREDIT' THEN d.amount_base_currency
              WHEN t.acc_type_code = 'REVENUE' AND d.entry_side = 'DEBIT' THEN -d.amount_base_currency
              WHEN t.acc_type_code = 'EXPENSE' AND d.entry_side = 'DEBIT' THEN -d.amount_base_currency
              WHEN t.acc_type_code = 'EXPENSE' AND d.entry_side = 'CREDIT' THEN d.amount_base_currency
              ELSE 0
            END
          ), 0) AS direct_profit
        FROM public.org_fin_journal_dtl d
        JOIN public.org_fin_journal_mst j
          ON j.id = d.journal_id
         AND j.tenant_org_id = d.tenant_org_id
        JOIN public.org_fin_acct_mst a
          ON a.id = d.account_id
         AND a.tenant_org_id = d.tenant_org_id
        JOIN public.sys_fin_acc_type_cd t
          ON t.acc_type_id = a.acc_type_id
        LEFT JOIN public.org_branches_mst b
          ON b.tenant_org_id = d.tenant_org_id
         AND b.id = COALESCE(d.branch_id, j.branch_id)
        WHERE d.tenant_org_id = ${tenantId}::uuid
          AND d.is_active = true
          AND d.rec_status = 1
          AND j.status_code = 'POSTED'
          AND j.is_active = true
          AND j.rec_status = 1
          AND t.acc_type_code IN ('REVENUE', 'EXPENSE')
          AND t.is_active = true
          AND t.rec_status = 1
        GROUP BY COALESCE(d.branch_id, j.branch_id), ${branchNameSql}
        HAVING COALESCE(SUM(
          CASE
            WHEN t.acc_type_code IN ('REVENUE', 'EXPENSE') THEN d.amount_base_currency
            ELSE 0
          END
        ), 0) <> 0
        ORDER BY branch_name ASC
      `);

      return rows.map((row) => ({
        ...row,
        direct_revenue: Number(row.direct_revenue ?? 0),
        direct_expense: Number(row.direct_expense ?? 0),
        direct_profit: Number(row.direct_profit ?? 0),
      }));
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }
    await assertErpLiteEnabledForTenant(tenantId);
    return tenantId;
  }

  private static async getStatementRows(
    statementFamily: 'BALANCE_SHEET' | 'PROFIT_LOSS',
    locale: ErpLiteReportLocale
  ): Promise<ErpLiteStatementRow[]> {
    const tenantId = await this.requireTenantId();
    const accountNameSql = this.accountNameSql(locale);

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<ErpLiteStatementRow[]>(Prisma.sql`
        SELECT
          COALESCE(g.stmt_section, t.statement_family) AS section_code,
          t.acc_type_code AS account_type_code,
          a.id AS account_id,
          a.account_code,
          ${accountNameSql} AS account_name,
          COALESCE(SUM(
            CASE
              WHEN j.id IS NULL THEN 0
              WHEN t.normal_balance = 'DEBIT' AND d.entry_side = 'DEBIT' THEN d.amount_base_currency
              WHEN t.normal_balance = 'DEBIT' AND d.entry_side = 'CREDIT' THEN -d.amount_base_currency
              WHEN t.normal_balance = 'CREDIT' AND d.entry_side = 'CREDIT' THEN d.amount_base_currency
              WHEN t.normal_balance = 'CREDIT' AND d.entry_side = 'DEBIT' THEN -d.amount_base_currency
              ELSE 0
            END
          ), 0) AS amount
        FROM public.org_fin_acct_mst a
        INNER JOIN public.sys_fin_acc_type_cd t
          ON t.acc_type_id = a.acc_type_id
        LEFT JOIN public.sys_fin_acc_group_cd g
          ON g.acc_group_id = a.acc_group_id
        LEFT JOIN public.org_fin_journal_dtl d
          ON d.account_id = a.id
         AND d.tenant_org_id = a.tenant_org_id
         AND d.is_active = true
         AND d.rec_status = 1
        LEFT JOIN public.org_fin_journal_mst j
          ON j.id = d.journal_id
         AND j.tenant_org_id = d.tenant_org_id
         AND j.status_code = 'POSTED'
         AND j.is_active = true
         AND j.rec_status = 1
        WHERE a.tenant_org_id = ${tenantId}::uuid
          AND a.is_active = true
          AND a.rec_status = 1
          AND a.is_postable = true
          AND t.statement_family = ${statementFamily}
          AND t.is_active = true
          AND t.rec_status = 1
        GROUP BY
          COALESCE(g.stmt_section, t.statement_family),
          t.acc_type_code,
          a.id,
          a.account_code,
          ${accountNameSql}
        HAVING COALESCE(SUM(
          CASE
            WHEN j.id IS NULL THEN 0
            WHEN t.normal_balance = 'DEBIT' AND d.entry_side = 'DEBIT' THEN d.amount_base_currency
            WHEN t.normal_balance = 'DEBIT' AND d.entry_side = 'CREDIT' THEN -d.amount_base_currency
            WHEN t.normal_balance = 'CREDIT' AND d.entry_side = 'CREDIT' THEN d.amount_base_currency
            WHEN t.normal_balance = 'CREDIT' AND d.entry_side = 'DEBIT' THEN -d.amount_base_currency
            ELSE 0
          END
        ), 0) <> 0
        ORDER BY COALESCE(g.stmt_section, t.statement_family), a.account_code ASC
      `);

      return rows.map((row) => ({
        ...row,
        amount: Number(row.amount ?? 0),
      }));
    });
  }

  private static accountNameSql(locale: ErpLiteReportLocale) {
    if (locale === 'ar') {
      return Prisma.sql`COALESCE(NULLIF(a.name2, ''), a.name)`;
    }

    return Prisma.sql`a.name`;
  }
}
