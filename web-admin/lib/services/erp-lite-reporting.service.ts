import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';

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

export class ErpLiteReportingService {
  static async getGlInquiry(limit = 50, locale: ErpLiteReportLocale = 'en'): Promise<ErpLiteGlInquiryRow[]> {
    const tenantId = await this.requireTenantId();
    const accountNameSql = this.accountNameSql(locale);

    return withTenantContext(tenantId, async () => {
      const rows = await prisma.$queryRaw<ErpLiteGlInquiryRow[]>(Prisma.sql`
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
          j.currency_code
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
        ORDER BY j.posting_date DESC, j.created_at DESC, d.line_no ASC
        LIMIT ${limit}
      `);

      return rows.map((row) => ({
        ...row,
        amount_txn_currency: Number(row.amount_txn_currency ?? 0),
      }));
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

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }
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
