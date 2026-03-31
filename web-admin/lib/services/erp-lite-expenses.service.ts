import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import type {
  CreateErpLiteCashTxnInput,
  CreateErpLiteCashboxInput,
  CreateErpLiteExpenseInput,
  ErpLiteCashTxnListItem,
  ErpLiteCashboxListItem,
  ErpLiteExpenseListItem,
  ErpLiteExpenseMutationResult,
  ErpLiteExpensesDashboardSnapshot,
  ErpLiteOptionItem,
} from '@/lib/types/erp-lite-expenses';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaSqlExecutor = Pick<typeof prisma, '$queryRaw'>;

interface LocalizedOptionRow {
  id: string;
  name: string | null;
  name2: string | null;
  code: string | null;
}

interface ExpenseInsertRow {
  id: string;
  expense_no: string;
  tenant_org_id: string;
  branch_id: string | null;
  expense_date: string;
  currency_code: string;
  exchange_rate: number;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  settlement_code: 'CASH' | 'BANK' | 'PAYABLE';
}

interface CashboxInsertRow {
  id: string;
  branch_id: string | null;
}

interface CashTxnInsertRow {
  id: string;
  txn_no: string;
  tenant_org_id: string;
  branch_id: string | null;
  txn_date: string;
  currency_code: string;
  exchange_rate: number;
  amount_total: number;
  txn_type_code: 'TOPUP' | 'SPEND';
  cashbox_id: string;
}

const EXPENSE_USAGE_CODE = 'EXPENSE_GENERAL';
const PETTY_CASH_USAGE_CODE = 'PETTY_CASH_MAIN';

export class ErpLiteExpensesService {
  static async getDashboardSnapshot(
    locale: 'en' | 'ar'
  ): Promise<ErpLiteExpensesDashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [expenseList, cashboxList, cashTxnList, branchOptions, cashboxAccountOptions] =
        await Promise.all([
          this.listRecentExpenses(tenantId, locale),
          this.listCashboxes(tenantId, locale),
          this.listRecentCashTransactions(tenantId, locale),
          this.listBranchOptions(tenantId, locale),
          this.listCashboxAccountOptions(tenantId, locale),
        ]);

      return {
        expense_list: expenseList,
        cashbox_list: cashboxList,
        cash_txn_list: cashTxnList,
        branch_options: branchOptions,
        cashbox_account_options: cashboxAccountOptions,
        cashbox_options: cashboxList.map((item) => ({
          id: item.id,
          label: `${item.cashbox_code} · ${item.cashbox_name}`,
        })),
      };
    });
  }

  static async createExpense(
    input: CreateErpLiteExpenseInput
  ): Promise<ErpLiteExpenseMutationResult> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      return prisma.$transaction(async (tx) => {
        const usageCodeId = await this.findUsageCodeId(EXPENSE_USAGE_CODE, tx);
        const expenseNo = await this.generateSequentialNo('EXP', 'expense_no', 'org_fin_exp_mst', tx);
        const subtotalAmount = this.roundAmount(input.subtotal_amount);
        const taxAmount = this.roundAmount(input.tax_amount ?? 0);
        const totalAmount = this.roundAmount(subtotalAmount + taxAmount);

        const inserted = await tx.$queryRaw<ExpenseInsertRow[]>(Prisma.sql`
          INSERT INTO public.org_fin_exp_mst (
            tenant_org_id,
            branch_id,
            expense_no,
            expense_date,
            posting_date,
            status_code,
            settlement_code,
            currency_code,
            exchange_rate,
            subtotal_amount,
            tax_amount,
            total_amount,
            payee_name,
            description,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${input.branch_id ?? null}::uuid,
            ${expenseNo},
            ${input.expense_date}::date,
            ${input.expense_date}::date,
            'RECORDED',
            ${input.settlement_code},
            ${input.currency_code},
            1,
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            ${input.payee_name ?? null},
            ${input.description ?? null},
            ${input.created_by ?? null},
            'ERP-Lite Phase 7 expense create',
            1,
            true
          )
          RETURNING
            id,
            expense_no,
            tenant_org_id::text,
            branch_id::text,
            TO_CHAR(expense_date, 'YYYY-MM-DD') AS expense_date,
            currency_code,
            exchange_rate::float8 AS exchange_rate,
            subtotal_amount::float8 AS subtotal_amount,
            tax_amount::float8 AS tax_amount,
            total_amount::float8 AS total_amount,
            settlement_code
        `);

        const expense = inserted[0];
        if (!expense) {
          throw new Error('Failed to create ERP-Lite expense');
        }

        await tx.$queryRaw(Prisma.sql`
          INSERT INTO public.org_fin_exp_dtl (
            tenant_org_id,
            expense_id,
            line_no,
            usage_code_id,
            branch_id,
            line_description,
            net_amount,
            tax_amount,
            gross_amount,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${expense.id}::uuid,
            1,
            ${usageCodeId}::uuid,
            ${input.branch_id ?? null}::uuid,
            ${input.description ?? null},
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            ${input.created_by ?? null},
            'ERP-Lite Phase 7 expense line create',
            1,
            true
          )
        `);

        const posting = await ErpLiteAutoPostService.dispatchExpenseRecordedInTransaction(tx, {
          expense_id: expense.id,
          expense_no: expense.expense_no,
          branch_id: expense.branch_id,
          currency_code: expense.currency_code,
          exchange_rate: expense.exchange_rate,
          expense_date: expense.expense_date,
          subtotal_amount: expense.subtotal_amount,
          tax_amount: expense.tax_amount,
          total_amount: expense.total_amount,
          settlement_code:
            expense.settlement_code === 'BANK' ? 'BANK' : 'CASH',
          created_by: input.created_by ?? null,
        });

        return {
          posting_status: posting.status,
          posting_success: posting.execute_result?.success,
          skip_reason: posting.skip_reason,
        };
      });
    });
  }

  static async createCashbox(input: CreateErpLiteCashboxInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const cashboxCode =
        input.cashbox_code?.trim() ||
        (await this.generateSequentialNo('PCB', 'cashbox_code', 'org_fin_cashbox_mst'));

      await prisma.$queryRaw(Prisma.sql`
        INSERT INTO public.org_fin_cashbox_mst (
          tenant_org_id,
          branch_id,
          account_id,
          cashbox_code,
          name,
          name2,
          currency_code,
          opening_balance,
          is_default,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.account_id}::uuid,
          ${cashboxCode},
          ${input.name},
          ${input.name2 ?? null},
          ${input.currency_code},
          ${this.roundAmount(input.opening_balance ?? 0)},
          false,
          ${input.created_by ?? null},
          'ERP-Lite Phase 7 cashbox create',
          1,
          true
        )
      `);
    });
  }

  static async createCashTransaction(
    input: CreateErpLiteCashTxnInput
  ): Promise<ErpLiteExpenseMutationResult> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      return prisma.$transaction(async (tx) => {
        const txnNo = await this.generateSequentialNo('PCT', 'txn_no', 'org_fin_cash_txn_tr', tx);
        const amountTotal = this.roundAmount(input.amount_total);
        const cashbox = await this.findCashbox(input.cashbox_id, tenantId, tx);

        const inserted = await tx.$queryRaw<CashTxnInsertRow[]>(Prisma.sql`
          INSERT INTO public.org_fin_cash_txn_tr (
            tenant_org_id,
            cashbox_id,
            branch_id,
            txn_no,
            txn_date,
            posting_date,
            txn_type_code,
            status_code,
            currency_code,
            exchange_rate,
            amount_total,
            funding_usage_code_id,
            expense_usage_code_id,
            description,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${cashbox.id}::uuid,
            ${cashbox.branch_id ?? null}::uuid,
            ${txnNo},
            ${input.txn_date}::date,
            ${input.txn_date}::date,
            ${input.txn_type_code},
            'RECORDED',
            ${input.currency_code},
            1,
            ${amountTotal},
            ${input.txn_type_code === 'TOPUP'
              ? Prisma.sql`(SELECT usage_code_id FROM public.sys_fin_usage_code_cd WHERE usage_code = ${'CASH_MAIN'} LIMIT 1)`
              : Prisma.sql`NULL`},
            ${input.txn_type_code === 'SPEND'
              ? Prisma.sql`(SELECT usage_code_id FROM public.sys_fin_usage_code_cd WHERE usage_code = ${'PETTY_CASH_EXPENSE'} LIMIT 1)`
              : Prisma.sql`NULL`},
            ${input.description ?? null},
            ${input.created_by ?? null},
            'ERP-Lite Phase 7 petty cash transaction create',
            1,
            true
          )
          RETURNING
            id,
            txn_no,
            tenant_org_id::text,
            branch_id::text,
            TO_CHAR(txn_date, 'YYYY-MM-DD') AS txn_date,
            currency_code,
            exchange_rate::float8 AS exchange_rate,
            amount_total::float8 AS amount_total,
            txn_type_code,
            cashbox_id::text
        `);

        const txn = inserted[0];
        if (!txn) {
          throw new Error('Failed to create petty cash transaction');
        }

        const posting = await ErpLiteAutoPostService.dispatchPettyCashTransactionInTransaction(tx, {
          cash_txn_id: txn.id,
          txn_no: txn.txn_no,
          cashbox_id: txn.cashbox_id,
          branch_id: txn.branch_id,
          currency_code: txn.currency_code,
          exchange_rate: txn.exchange_rate,
          txn_date: txn.txn_date,
          amount_total: txn.amount_total,
          txn_type_code: txn.txn_type_code,
          created_by: input.created_by ?? null,
        });

        return {
          posting_status: posting.status,
          posting_success: posting.execute_result?.success,
          skip_reason: posting.skip_reason,
        };
      });
    });
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }
    return tenantId;
  }

  private static async listBranchOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        name,
        name2,
        branch_code AS code
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY name ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      label: this.localize(row, locale),
    }));
  }

  private static async listCashboxAccountOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteOptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT
        a.id::text AS id,
        a.name,
        a.name2,
        a.account_code AS code
      FROM public.org_fin_usage_map_mst m
      INNER JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = m.usage_code_id
      INNER JOIN public.org_fin_acct_mst a
        ON a.id = m.account_id
       AND a.tenant_org_id = m.tenant_org_id
      WHERE m.tenant_org_id = ${tenantId}::uuid
        AND u.usage_code = ${PETTY_CASH_USAGE_CODE}
        AND m.status_code = 'ACTIVE'
        AND m.is_active = true
        AND m.rec_status = 1
        AND a.is_active = true
        AND a.rec_status = 1
        AND a.is_postable = true
      ORDER BY a.account_code ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      label: this.localize(row, locale),
    }));
  }

  private static async listRecentExpenses(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteExpenseListItem[]> {
    const branchNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name)`
      : Prisma.sql`b.name`;

    const payeeNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(e.payee_name2, ''), e.payee_name)`
      : Prisma.sql`e.payee_name`;

    const rows = await prisma.$queryRaw<ErpLiteExpenseListItem[]>(Prisma.sql`
      SELECT
        e.id::text AS id,
        e.expense_no,
        TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
        ${branchNameSql} AS branch_name,
        e.settlement_code,
        e.total_amount::float8 AS total_amount,
        e.currency_code,
        e.status_code,
        ${payeeNameSql} AS payee_name
      FROM public.org_fin_exp_mst e
      LEFT JOIN public.org_branches_mst b
        ON b.id = e.branch_id
       AND b.tenant_org_id = e.tenant_org_id
      WHERE e.tenant_org_id = ${tenantId}::uuid
        AND e.is_active = true
        AND e.rec_status = 1
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT 12
    `);

    return rows.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount ?? 0),
    }));
  }

  private static async listCashboxes(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteCashboxListItem[]> {
    const cashboxNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(c.name2, ''), c.name)`
      : Prisma.sql`c.name`;
    const branchNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name)`
      : Prisma.sql`b.name`;
    const accountNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(a.name2, ''), a.name)`
      : Prisma.sql`a.name`;

    const rows = await prisma.$queryRaw<ErpLiteCashboxListItem[]>(Prisma.sql`
      SELECT
        c.id::text AS id,
        c.cashbox_code,
        ${cashboxNameSql} AS cashbox_name,
        ${branchNameSql} AS branch_name,
        c.currency_code,
        c.opening_balance::float8 AS opening_balance,
        (
          c.opening_balance
          + COALESCE(SUM(
              CASE
                WHEN t.status_code <> 'RECORDED' THEN 0
                WHEN t.txn_type_code = 'TOPUP' THEN t.amount_total
                WHEN t.txn_type_code = 'SPEND' THEN -t.amount_total
                ELSE 0
              END
            ), 0)
        )::float8 AS current_balance,
        a.account_code,
        ${accountNameSql} AS account_name
      FROM public.org_fin_cashbox_mst c
      INNER JOIN public.org_fin_acct_mst a
        ON a.id = c.account_id
       AND a.tenant_org_id = c.tenant_org_id
      LEFT JOIN public.org_branches_mst b
        ON b.id = c.branch_id
       AND b.tenant_org_id = c.tenant_org_id
      LEFT JOIN public.org_fin_cash_txn_tr t
        ON t.cashbox_id = c.id
       AND t.tenant_org_id = c.tenant_org_id
       AND t.is_active = true
       AND t.rec_status = 1
      WHERE c.tenant_org_id = ${tenantId}::uuid
        AND c.is_active = true
        AND c.rec_status = 1
      GROUP BY c.id, c.cashbox_code, c.name, c.name2, b.name, b.name2, c.currency_code,
        c.opening_balance, a.account_code, a.name, a.name2
      ORDER BY c.cashbox_code ASC
    `);

    return rows.map((row) => ({
      ...row,
      opening_balance: Number(row.opening_balance ?? 0),
      current_balance: Number(row.current_balance ?? 0),
    }));
  }

  private static async listRecentCashTransactions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteCashTxnListItem[]> {
    const cashboxNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(c.name2, ''), c.name)`
      : Prisma.sql`c.name`;
    const branchNameSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(b.name2, ''), b.name)`
      : Prisma.sql`b.name`;
    const descSql = locale === 'ar'
      ? Prisma.sql`COALESCE(NULLIF(t.description2, ''), t.description)`
      : Prisma.sql`t.description`;

    const rows = await prisma.$queryRaw<ErpLiteCashTxnListItem[]>(Prisma.sql`
      SELECT
        t.id::text AS id,
        t.txn_no,
        TO_CHAR(t.txn_date, 'YYYY-MM-DD') AS txn_date,
        t.txn_type_code,
        ${cashboxNameSql} AS cashbox_name,
        ${branchNameSql} AS branch_name,
        t.amount_total::float8 AS amount_total,
        t.currency_code,
        t.status_code,
        ${descSql} AS description
      FROM public.org_fin_cash_txn_tr t
      INNER JOIN public.org_fin_cashbox_mst c
        ON c.id = t.cashbox_id
       AND c.tenant_org_id = t.tenant_org_id
      LEFT JOIN public.org_branches_mst b
        ON b.id = t.branch_id
       AND b.tenant_org_id = t.tenant_org_id
      WHERE t.tenant_org_id = ${tenantId}::uuid
        AND t.is_active = true
        AND t.rec_status = 1
      ORDER BY t.txn_date DESC, t.created_at DESC
      LIMIT 12
    `);

    return rows.map((row) => ({
      ...row,
      amount_total: Number(row.amount_total ?? 0),
    }));
  }

  private static async findUsageCodeId(
    usageCode: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<string> {
    const rows = await db.$queryRaw<{ usage_code_id: string }[]>(Prisma.sql`
      SELECT usage_code_id::text
      FROM public.sys_fin_usage_code_cd
      WHERE usage_code = ${usageCode}
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      throw new Error(`Required usage code ${usageCode} is not available`);
    }

    return row.usage_code_id;
  }

  private static async findCashbox(
    cashboxId: string,
    tenantId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<CashboxInsertRow> {
    const rows = await db.$queryRaw<CashboxInsertRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        branch_id::text AS branch_id
      FROM public.org_fin_cashbox_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${cashboxId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      throw new Error('Petty cash cashbox not found');
    }

    return row;
  }

  private static async generateSequentialNo(
    prefix: string,
    columnName: 'expense_no' | 'cashbox_code' | 'txn_no',
    tableName: 'org_fin_exp_mst' | 'org_fin_cashbox_mst' | 'org_fin_cash_txn_tr',
    db: PrismaSqlExecutor = prisma
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const serialPrefix = `${prefix}-${year}${month}`;
    const countColumn =
      columnName === 'expense_no'
        ? Prisma.sql`expense_no`
        : columnName === 'cashbox_code'
          ? Prisma.sql`cashbox_code`
          : Prisma.sql`txn_no`;
    const tableSql =
      tableName === 'org_fin_exp_mst'
        ? Prisma.sql`public.org_fin_exp_mst`
        : tableName === 'org_fin_cashbox_mst'
          ? Prisma.sql`public.org_fin_cashbox_mst`
          : Prisma.sql`public.org_fin_cash_txn_tr`;

    const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM ${tableSql}
      WHERE ${countColumn} LIKE ${`${serialPrefix}%`}
    `);

    const seq = String((rows[0]?.count ?? 0) + 1).padStart(5, '0');
    return `${serialPrefix}-${seq}`;
  }

  private static localize(row: LocalizedOptionRow, locale: 'en' | 'ar'): string {
    const name =
      locale === 'ar'
        ? row.name2?.trim() || row.name?.trim() || row.code?.trim() || row.id
        : row.name?.trim() || row.name2?.trim() || row.code?.trim() || row.id;
    return row.code ? `${row.code} · ${name}` : name;
  }

  private static roundAmount(value: number): number {
    return Number(Number(value ?? 0).toFixed(4));
  }
}
