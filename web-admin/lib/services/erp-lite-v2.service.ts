import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import type {
  CreateErpLiteApInvoiceInput,
  CreateErpLiteApPaymentInput,
  CreateErpLiteBankAccountInput,
  CreateErpLiteBankReconInput,
  CreateErpLiteBankStatementInput,
  CreateErpLitePurchaseOrderInput,
  CreateErpLiteSupplierInput,
  ErpLiteApDashboardSnapshot,
  ErpLiteApInvoiceListItem,
  ErpLiteApPaymentListItem,
  ErpLiteBankAccountListItem,
  ErpLiteBankDashboardSnapshot,
  ErpLiteBankReconciliationListItem,
  ErpLiteBankStatementListItem,
  ErpLitePoDashboardSnapshot,
  ErpLitePoListItem,
  ErpLiteSupplierListItem,
  ErpLiteV2OptionItem,
} from '@/lib/types/erp-lite-v2';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaSqlExecutor = Pick<typeof prisma, '$queryRaw'>;

interface LocalizedOptionRow {
  id: string;
  code: string | null;
  name: string | null;
  name2: string | null;
}

interface SupplierInsertRow {
  id: string;
  supplier_code: string;
}

interface PoInsertRow {
  id: string;
  po_no: string;
}

interface ApInvoiceInsertRow {
  id: string;
  ap_inv_no: string;
}

interface ApPaymentInsertRow {
  id: string;
  ap_pmt_no: string;
}

interface BankAccountInsertRow {
  id: string;
  bank_code: string;
}

interface BankStatementInsertRow {
  id: string;
  import_batch_no: string;
}

interface BankReconInsertRow {
  id: string;
  recon_code: string;
}

interface SupplierValidationRow {
  id: string;
  branch_id: string | null;
  payable_acct_id: string | null;
  currency_code: string;
  status_code: string;
  posting_hold: boolean;
}

interface ApInvoiceValidationRow {
  id: string;
  supplier_id: string;
  branch_id: string | null;
  currency_code: string;
  open_amount: number;
  status_code: string;
}

interface BankAccountValidationRow {
  id: string;
  branch_id: string | null;
  currency_code: string;
  status_code: string;
}

interface CashboxValidationRow {
  id: string;
  branch_id: string | null;
  currency_code: string;
}

const DEFAULT_PO_USAGE_CODE = 'EXPENSE_GENERAL';
const PREFIX_SUPPLIER = 'SUP';
const PREFIX_PO = 'PO';
const PREFIX_AP_INV = 'API';
const PREFIX_AP_PMT = 'APP';
const PREFIX_BANK = 'BNK';
const PREFIX_STMT = 'BST';
const PREFIX_RECON = 'BRC';

export class ErpLiteV2Service {
  static async getApDashboardSnapshot(
    locale: 'en' | 'ar'
  ): Promise<ErpLiteApDashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [
        supplierList,
        apInvoiceList,
        apPaymentList,
        branchOptions,
        supplierOptions,
        payableAccountOptions,
        invoiceOptions,
        bankAccountOptions,
        cashboxOptions,
      ] = await Promise.all([
        this.listSuppliers(tenantId, locale),
        this.listApInvoices(tenantId, locale),
        this.listApPayments(tenantId, locale),
        this.listBranchOptions(tenantId, locale),
        this.listSupplierOptions(tenantId, locale),
        this.listPayableAccountOptions(tenantId, locale),
        this.listOpenApInvoiceOptions(tenantId),
        this.listBankAccountOptions(tenantId, locale),
        this.listCashboxOptions(tenantId, locale),
      ]);

      return {
        supplier_list: supplierList,
        ap_invoice_list: apInvoiceList,
        ap_payment_list: apPaymentList,
        branch_options: branchOptions,
        supplier_options: supplierOptions,
        payable_account_options: payableAccountOptions,
        invoice_options: invoiceOptions,
        bank_account_options: bankAccountOptions,
        cashbox_options: cashboxOptions,
      };
    });
  }

  static async getPoDashboardSnapshot(
    locale: 'en' | 'ar'
  ): Promise<ErpLitePoDashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [poList, branchOptions, supplierOptions, usageCodeOptions] = await Promise.all([
        this.listPurchaseOrders(tenantId, locale),
        this.listBranchOptions(tenantId, locale),
        this.listSupplierOptions(tenantId, locale),
        this.listUsageCodeOptions(locale),
      ]);

      return {
        po_list: poList,
        branch_options: branchOptions,
        supplier_options: supplierOptions,
        usage_code_options: usageCodeOptions,
      };
    });
  }

  static async getBankDashboardSnapshot(
    locale: 'en' | 'ar'
  ): Promise<ErpLiteBankDashboardSnapshot> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const [
        bankAccountList,
        bankStatementList,
        bankReconList,
        branchOptions,
        bankGlAccountOptions,
        bankAccountOptions,
        periodOptions,
      ] = await Promise.all([
        this.listBankAccounts(tenantId, locale),
        this.listBankStatements(tenantId, locale),
        this.listBankReconciliations(tenantId, locale),
        this.listBranchOptions(tenantId, locale),
        this.listBankGlAccountOptions(tenantId, locale),
        this.listBankAccountOptions(tenantId, locale),
        this.listPeriodOptions(tenantId),
      ]);

      return {
        bank_account_list: bankAccountList,
        bank_statement_list: bankStatementList,
        bank_recon_list: bankReconList,
        branch_options: branchOptions,
        bank_gl_account_options: bankGlAccountOptions,
        bank_account_options: bankAccountOptions,
        period_options: periodOptions,
      };
    });
  }

  static async createSupplier(input: CreateErpLiteSupplierInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      await this.assertValidBranch(tenantId, input.branch_id);
      await this.assertValidPayableAccount(tenantId, input.payable_acct_id);
      this.assertRequiredString(input.name, 'name');
      this.assertRequiredString(input.currency_code, 'currency_code');
      this.assertNonNegativeInteger(input.payment_terms_days ?? 0, 'payment_terms_days');

      const supplierCode =
        input.supplier_code?.trim() ||
        (await this.generateSequentialNo(tenantId, PREFIX_SUPPLIER, 'supplier_code', 'org_fin_supp_mst'));

      const usageCodeId = await this.findUsageCodeId(DEFAULT_PO_USAGE_CODE);

      await prisma.$queryRaw<SupplierInsertRow[]>(Prisma.sql`
        INSERT INTO public.org_fin_supp_mst (
          tenant_org_id,
          branch_id,
          payable_acct_id,
          default_usage_id,
          supplier_code,
          name,
          name2,
          email,
          phone,
          payment_terms_days,
          currency_code,
          status_code,
          posting_hold,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.payable_acct_id ?? null}::uuid,
          ${usageCodeId}::uuid,
          ${supplierCode},
          ${input.name.trim()},
          ${input.name2?.trim() || null},
          ${input.email?.trim() || null},
          ${input.phone?.trim() || null},
          ${input.payment_terms_days ?? 0},
          ${input.currency_code.trim()},
          'ACTIVE',
          false,
          ${input.created_by ?? null},
          'ERP-Lite Phase 9 supplier create',
          1,
          true
        )
        RETURNING id, supplier_code
      `);
    });
  }

  static async createPurchaseOrder(input: CreateErpLitePurchaseOrderInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      await prisma.$transaction(async (tx) => {
        const supplier = await this.requireActiveSupplier(tenantId, input.supplier_id, tx);
        await this.assertValidBranch(tenantId, input.branch_id, tx);
        this.assertRequiredString(input.po_date, 'po_date');
        this.assertRequiredString(input.currency_code, 'currency_code');
        this.assertPositiveAmount(input.subtotal_amount, 'subtotal_amount');
        this.assertNonNegativeAmount(input.tax_amount ?? 0, 'tax_amount');
        this.assertRequiredString(input.description, 'description');

        if (supplier.posting_hold) {
          throw new Error('Selected supplier is currently on posting hold');
        }

        const usageCodeId =
          input.usage_code_id ?? (await this.findUsageCodeId(DEFAULT_PO_USAGE_CODE, tx));
        const poNo = await this.generateSequentialNo(
          tenantId,
          PREFIX_PO,
          'po_no',
          'org_fin_po_mst',
          tx
        );
        const subtotalAmount = this.roundAmount(input.subtotal_amount);
        const taxAmount = this.roundAmount(input.tax_amount ?? 0);
        const totalAmount = this.roundAmount(subtotalAmount + taxAmount);

        const inserted = await tx.$queryRaw<PoInsertRow[]>(Prisma.sql`
          INSERT INTO public.org_fin_po_mst (
            tenant_org_id,
            supplier_id,
            branch_id,
            po_no,
            po_date,
            expected_date,
            currency_code,
            exchange_rate,
            subtotal_amount,
            tax_amount,
            total_amount,
            status_code,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${input.supplier_id}::uuid,
            ${input.branch_id ?? null}::uuid,
            ${poNo},
            ${input.po_date}::date,
            ${input.expected_date ?? null}::date,
            ${input.currency_code.trim()},
            1,
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            'DRAFT',
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 purchase order create',
            1,
            true
          )
          RETURNING id, po_no
        `);

        const po = inserted[0];
        if (!po) {
          throw new Error('Failed to create purchase order');
        }

        await tx.$queryRaw(Prisma.sql`
          INSERT INTO public.org_fin_po_dtl (
            tenant_org_id,
            po_id,
            line_no,
            branch_id,
            usage_code_id,
            description,
            description2,
            qty_ordered,
            qty_received,
            unit_price,
            net_amount,
            tax_amount,
            gross_amount,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${po.id}::uuid,
            1,
            ${input.branch_id ?? null}::uuid,
            ${usageCodeId}::uuid,
            ${input.description.trim()},
            ${input.description2?.trim() || null},
            1,
            0,
            ${subtotalAmount},
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 purchase order line create',
            1,
            true
          )
        `);
      });
    });
  }

  static async createApInvoice(input: CreateErpLiteApInvoiceInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      await prisma.$transaction(async (tx) => {
        const supplier = await this.requireActiveSupplier(tenantId, input.supplier_id, tx);
        await this.assertValidBranch(tenantId, input.branch_id, tx);
        await this.assertValidPurchaseOrder(tenantId, input.po_id, input.supplier_id, tx);
        this.assertRequiredString(input.invoice_date, 'invoice_date');
        this.assertRequiredString(input.currency_code, 'currency_code');
        this.assertPositiveAmount(input.subtotal_amount, 'subtotal_amount');
        this.assertNonNegativeAmount(input.tax_amount ?? 0, 'tax_amount');
        this.assertRequiredString(input.description, 'description');

        if (supplier.posting_hold) {
          throw new Error('Selected supplier is currently on posting hold');
        }

        const usageCodeId =
          input.usage_code_id ?? (await this.findUsageCodeId(DEFAULT_PO_USAGE_CODE, tx));
        const apInvNo = await this.generateSequentialNo(
          tenantId,
          PREFIX_AP_INV,
          'ap_inv_no',
          'org_fin_ap_inv_mst',
          tx
        );
        const subtotalAmount = this.roundAmount(input.subtotal_amount);
        const taxAmount = this.roundAmount(input.tax_amount ?? 0);
        const totalAmount = this.roundAmount(subtotalAmount + taxAmount);
        const dueDate =
          input.due_date ??
          this.addDays(input.invoice_date, supplier.payment_terms_days);

        const inserted = await tx.$queryRaw<ApInvoiceInsertRow[]>(Prisma.sql`
          INSERT INTO public.org_fin_ap_inv_mst (
            tenant_org_id,
            supplier_id,
            branch_id,
            po_id,
            ap_inv_no,
            supplier_inv_no,
            invoice_date,
            due_date,
            currency_code,
            exchange_rate,
            subtotal_amount,
            tax_amount,
            total_amount,
            open_amount,
            status_code,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${input.supplier_id}::uuid,
            ${input.branch_id ?? null}::uuid,
            ${input.po_id ?? null}::uuid,
            ${apInvNo},
            ${input.supplier_inv_no?.trim() || null},
            ${input.invoice_date}::date,
            ${dueDate}::date,
            ${input.currency_code.trim()},
            1,
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            ${totalAmount},
            'POSTED',
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 AP invoice create',
            1,
            true
          )
          RETURNING id, ap_inv_no
        `);

        const apInvoice = inserted[0];
        if (!apInvoice) {
          throw new Error('Failed to create AP invoice');
        }

        await tx.$queryRaw(Prisma.sql`
          INSERT INTO public.org_fin_ap_inv_dtl (
            tenant_org_id,
            ap_inv_id,
            po_line_id,
            line_no,
            branch_id,
            usage_code_id,
            description,
            description2,
            net_amount,
            tax_amount,
            gross_amount,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${apInvoice.id}::uuid,
            NULL,
            1,
            ${input.branch_id ?? null}::uuid,
            ${usageCodeId}::uuid,
            ${input.description.trim()},
            ${input.description2?.trim() || null},
            ${subtotalAmount},
            ${taxAmount},
            ${totalAmount},
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 AP invoice line create',
            1,
            true
          )
        `);
      });
    });
  }

  static async createApPayment(input: CreateErpLiteApPaymentInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      await prisma.$transaction(async (tx) => {
        const supplier = await this.requireActiveSupplier(tenantId, input.supplier_id, tx);
        const invoice = await this.requireOpenApInvoice(
          tenantId,
          input.ap_invoice_id,
          input.supplier_id,
          tx
        );

        await this.assertValidBranch(tenantId, input.branch_id, tx);
        await this.assertValidSettlementSource(
          tenantId,
          input.settlement_code,
          input.bank_account_id,
          input.cashbox_id,
          input.currency_code,
          tx
        );

        this.assertRequiredString(input.payment_date, 'payment_date');
        this.assertRequiredString(input.currency_code, 'currency_code');
        this.assertPositiveAmount(input.amount_total, 'amount_total');

        if (supplier.posting_hold) {
          throw new Error('Selected supplier is currently on posting hold');
        }
        if (invoice.currency_code !== input.currency_code.trim()) {
          throw new Error('AP payment currency must match the selected AP invoice currency');
        }

        const amountTotal = this.roundAmount(input.amount_total);
        if (amountTotal > invoice.open_amount) {
          throw new Error('AP payment amount cannot exceed the selected invoice open amount');
        }

        const apPmtNo = await this.generateSequentialNo(
          tenantId,
          PREFIX_AP_PMT,
          'ap_pmt_no',
          'org_fin_ap_pmt_mst',
          tx
        );

        const inserted = await tx.$queryRaw<ApPaymentInsertRow[]>(Prisma.sql`
          INSERT INTO public.org_fin_ap_pmt_mst (
            tenant_org_id,
            supplier_id,
            branch_id,
            bank_account_id,
            cashbox_id,
            ap_pmt_no,
            payment_date,
            currency_code,
            exchange_rate,
            amount_total,
            settlement_code,
            payment_method_code,
            ext_ref_no,
            status_code,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${input.supplier_id}::uuid,
            ${input.branch_id ?? null}::uuid,
            ${input.bank_account_id ?? null}::uuid,
            ${input.cashbox_id ?? null}::uuid,
            ${apPmtNo},
            ${input.payment_date}::date,
            ${input.currency_code.trim()},
            1,
            ${amountTotal},
            ${input.settlement_code},
            ${input.payment_method_code?.trim() || null},
            ${input.ext_ref_no?.trim() || null},
            'POSTED',
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 AP payment create',
            1,
            true
          )
          RETURNING id, ap_pmt_no
        `);

        const apPayment = inserted[0];
        if (!apPayment) {
          throw new Error('Failed to create AP payment');
        }

        await tx.$queryRaw(Prisma.sql`
          INSERT INTO public.org_fin_ap_alloc_tr (
            tenant_org_id,
            ap_payment_id,
            ap_invoice_id,
            alloc_no,
            alloc_amount,
            created_by,
            created_info,
            rec_status,
            is_active
          ) VALUES (
            ${tenantId}::uuid,
            ${apPayment.id}::uuid,
            ${input.ap_invoice_id}::uuid,
            1,
            ${amountTotal},
            ${input.created_by ?? null},
            'ERP-Lite Phase 9 AP payment allocation create',
            1,
            true
          )
        `);

        const newOpenAmount = this.roundAmount(invoice.open_amount - amountTotal);
        const nextStatus = newOpenAmount === 0 ? 'PAID' : 'PARTIAL';

        await tx.$queryRaw(Prisma.sql`
          UPDATE public.org_fin_ap_inv_mst
          SET
            open_amount = ${newOpenAmount},
            status_code = ${nextStatus},
            updated_at = CURRENT_TIMESTAMP,
            updated_by = ${input.created_by ?? null},
            updated_info = 'ERP-Lite Phase 9 AP payment allocation update'
          WHERE tenant_org_id = ${tenantId}::uuid
            AND id = ${input.ap_invoice_id}::uuid
        `);
      });
    });
  }

  static async createBankAccount(input: CreateErpLiteBankAccountInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      await this.assertValidBranch(tenantId, input.branch_id);
      await this.assertValidTenantAccount(tenantId, input.account_id, 'Selected GL account was not found');
      this.assertRequiredString(input.name, 'name');
      this.assertRequiredString(input.bank_account_no, 'bank_account_no');
      this.assertRequiredString(input.currency_code, 'currency_code');

      const bankCode =
        input.bank_code?.trim() ||
        (await this.generateSequentialNo(
          tenantId,
          PREFIX_BANK,
          'bank_code',
          'org_fin_bank_acct_mst'
        ));

      await prisma.$queryRaw<BankAccountInsertRow[]>(Prisma.sql`
        INSERT INTO public.org_fin_bank_acct_mst (
          tenant_org_id,
          branch_id,
          account_id,
          bank_code,
          name,
          name2,
          bank_name,
          bank_name2,
          bank_account_no,
          iban_no,
          currency_code,
          stmt_import_mode,
          match_mode,
          allow_auto_match,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${input.branch_id ?? null}::uuid,
          ${input.account_id}::uuid,
          ${bankCode},
          ${input.name.trim()},
          ${input.name2?.trim() || null},
          ${input.bank_name?.trim() || null},
          ${input.bank_name2?.trim() || null},
          ${input.bank_account_no.trim()},
          ${input.iban_no?.trim() || null},
          ${input.currency_code.trim()},
          ${input.stmt_import_mode ?? 'CSV'},
          ${input.match_mode ?? 'STRICT'},
          false,
          'ACTIVE',
          ${input.created_by ?? null},
          'ERP-Lite Phase 9 bank account create',
          1,
          true
        )
        RETURNING id, bank_code
      `);
    });
  }

  static async createBankStatement(input: CreateErpLiteBankStatementInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const bankAccount = await this.requireActiveBankAccount(tenantId, input.bank_account_id);
      this.assertRequiredString(input.stmt_date_from, 'stmt_date_from');
      this.assertRequiredString(input.stmt_date_to, 'stmt_date_to');

      await prisma.$queryRaw<BankStatementInsertRow[]>(Prisma.sql`
        INSERT INTO public.org_fin_bank_stmt_mst (
          tenant_org_id,
          bank_account_id,
          import_batch_no,
          source_code,
          source_file_name,
          stmt_date_from,
          stmt_date_to,
          opening_balance,
          closing_balance,
          line_count,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${bankAccount.id}::uuid,
          ${await this.generateSequentialNo(tenantId, PREFIX_STMT, 'import_batch_no', 'org_fin_bank_stmt_mst')},
          'MANUAL',
          ${input.source_file_name?.trim() || null},
          ${input.stmt_date_from}::date,
          ${input.stmt_date_to}::date,
          ${input.opening_balance ?? null},
          ${input.closing_balance ?? null},
          0,
          'IMPORTED',
          ${input.created_by ?? null},
          'ERP-Lite Phase 9 bank statement create',
          1,
          true
        )
        RETURNING id, import_batch_no
      `);
    });
  }

  static async createBankRecon(input: CreateErpLiteBankReconInput): Promise<void> {
    const tenantId = await this.requireTenantId();

    return withTenantContext(tenantId, async () => {
      const bankAccount = await this.requireActiveBankAccount(tenantId, input.bank_account_id);
      await this.assertValidPeriod(tenantId, input.period_id);
      this.assertRequiredString(input.recon_date, 'recon_date');
      this.assertRequiredString(input.stmt_date_from, 'stmt_date_from');
      this.assertRequiredString(input.stmt_date_to, 'stmt_date_to');

      await prisma.$queryRaw<BankReconInsertRow[]>(Prisma.sql`
        INSERT INTO public.org_fin_bank_recon_mst (
          tenant_org_id,
          bank_account_id,
          period_id,
          recon_code,
          recon_date,
          stmt_date_from,
          stmt_date_to,
          gl_balance,
          stmt_balance,
          unmatched_amount,
          status_code,
          created_by,
          created_info,
          rec_status,
          is_active
        ) VALUES (
          ${tenantId}::uuid,
          ${bankAccount.id}::uuid,
          ${input.period_id ?? null}::uuid,
          ${await this.generateSequentialNo(tenantId, PREFIX_RECON, 'recon_code', 'org_fin_bank_recon_mst')},
          ${input.recon_date}::date,
          ${input.stmt_date_from}::date,
          ${input.stmt_date_to}::date,
          ${input.gl_balance ?? null},
          ${input.stmt_balance ?? null},
          ${input.unmatched_amount ?? null},
          'OPEN',
          ${input.created_by ?? null},
          'ERP-Lite Phase 9 bank reconciliation create',
          1,
          true
        )
        RETURNING id, recon_code
      `);
    });
  }

  private static async listSuppliers(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteSupplierListItem[]> {
    const rows = await prisma.$queryRaw<ErpLiteSupplierListItem[]>(Prisma.sql`
      SELECT
        s.id::text AS id,
        s.supplier_code,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(s.name2, ''), s.name)
          ELSE s.name
        END AS supplier_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS branch_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(a.name2, ''), a.name)
          ELSE a.name
        END AS payable_account_name,
        s.currency_code,
        s.payment_terms_days,
        s.status_code
      FROM public.org_fin_supp_mst s
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = s.tenant_org_id
       AND b.id = s.branch_id
      LEFT JOIN public.org_fin_acct_mst a
        ON a.tenant_org_id = s.tenant_org_id
       AND a.id = s.payable_acct_id
      WHERE s.tenant_org_id = ${tenantId}::uuid
        AND s.is_active = true
        AND s.rec_status = 1
      ORDER BY s.created_at DESC
      LIMIT 8
    `);

    return rows;
  }

  private static async listApInvoices(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteApInvoiceListItem[]> {
    return prisma.$queryRaw<ErpLiteApInvoiceListItem[]>(Prisma.sql`
      SELECT
        i.id::text AS id,
        i.ap_inv_no,
        TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS invoice_date,
        CASE WHEN i.due_date IS NULL THEN NULL ELSE TO_CHAR(i.due_date, 'YYYY-MM-DD') END AS due_date,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(s.name2, ''), s.name)
          ELSE s.name
        END AS supplier_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS branch_name,
        i.total_amount::float8 AS total_amount,
        i.open_amount::float8 AS open_amount,
        i.currency_code,
        i.status_code
      FROM public.org_fin_ap_inv_mst i
      JOIN public.org_fin_supp_mst s
        ON s.tenant_org_id = i.tenant_org_id
       AND s.id = i.supplier_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = i.tenant_org_id
       AND b.id = i.branch_id
      WHERE i.tenant_org_id = ${tenantId}::uuid
        AND i.is_active = true
        AND i.rec_status = 1
      ORDER BY i.invoice_date DESC, i.created_at DESC
      LIMIT 8
    `);
  }

  private static async listApPayments(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteApPaymentListItem[]> {
    return prisma.$queryRaw<ErpLiteApPaymentListItem[]>(Prisma.sql`
      SELECT
        p.id::text AS id,
        p.ap_pmt_no,
        TO_CHAR(p.payment_date, 'YYYY-MM-DD') AS payment_date,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(s.name2, ''), s.name)
          ELSE s.name
        END AS supplier_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS branch_name,
        p.amount_total::float8 AS amount_total,
        p.currency_code,
        p.settlement_code,
        p.status_code
      FROM public.org_fin_ap_pmt_mst p
      JOIN public.org_fin_supp_mst s
        ON s.tenant_org_id = p.tenant_org_id
       AND s.id = p.supplier_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = p.tenant_org_id
       AND b.id = p.branch_id
      WHERE p.tenant_org_id = ${tenantId}::uuid
        AND p.is_active = true
        AND p.rec_status = 1
      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT 8
    `);
  }

  private static async listPurchaseOrders(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLitePoListItem[]> {
    return prisma.$queryRaw<ErpLitePoListItem[]>(Prisma.sql`
      SELECT
        p.id::text AS id,
        p.po_no,
        TO_CHAR(p.po_date, 'YYYY-MM-DD') AS po_date,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(s.name2, ''), s.name)
          ELSE s.name
        END AS supplier_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS branch_name,
        p.total_amount::float8 AS total_amount,
        p.currency_code,
        p.status_code
      FROM public.org_fin_po_mst p
      JOIN public.org_fin_supp_mst s
        ON s.tenant_org_id = p.tenant_org_id
       AND s.id = p.supplier_id
      LEFT JOIN public.org_branches_mst b
        ON b.tenant_org_id = p.tenant_org_id
       AND b.id = p.branch_id
      WHERE p.tenant_org_id = ${tenantId}::uuid
        AND p.is_active = true
        AND p.rec_status = 1
      ORDER BY p.po_date DESC, p.created_at DESC
      LIMIT 8
    `);
  }

  private static async listBankAccounts(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteBankAccountListItem[]> {
    return prisma.$queryRaw<ErpLiteBankAccountListItem[]>(Prisma.sql`
      SELECT
        bnk.id::text AS id,
        bnk.bank_code,
        bnk.bank_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(bnk.name2, ''), bnk.name)
          ELSE bnk.name
        END AS account_name,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(br.name2, ''), br.name)
          ELSE br.name
        END AS branch_name,
        bnk.currency_code,
        bnk.status_code,
        bnk.stmt_import_mode
      FROM public.org_fin_bank_acct_mst bnk
      LEFT JOIN public.org_branches_mst br
        ON br.tenant_org_id = bnk.tenant_org_id
       AND br.id = bnk.branch_id
      WHERE bnk.tenant_org_id = ${tenantId}::uuid
        AND bnk.is_active = true
        AND bnk.rec_status = 1
      ORDER BY bnk.created_at DESC
      LIMIT 8
    `);
  }

  private static async listBankStatements(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteBankStatementListItem[]> {
    return prisma.$queryRaw<ErpLiteBankStatementListItem[]>(Prisma.sql`
      SELECT
        s.id::text AS id,
        s.import_batch_no,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS bank_name,
        TO_CHAR(s.stmt_date_from, 'YYYY-MM-DD') AS stmt_date_from,
        TO_CHAR(s.stmt_date_to, 'YYYY-MM-DD') AS stmt_date_to,
        s.line_count,
        s.status_code
      FROM public.org_fin_bank_stmt_mst s
      JOIN public.org_fin_bank_acct_mst b
        ON b.tenant_org_id = s.tenant_org_id
       AND b.id = s.bank_account_id
      WHERE s.tenant_org_id = ${tenantId}::uuid
        AND s.is_active = true
        AND s.rec_status = 1
      ORDER BY s.imported_at DESC, s.created_at DESC
      LIMIT 8
    `);
  }

  private static async listBankReconciliations(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteBankReconciliationListItem[]> {
    return prisma.$queryRaw<ErpLiteBankReconciliationListItem[]>(Prisma.sql`
      SELECT
        r.id::text AS id,
        r.recon_code,
        CASE
          WHEN ${locale} = 'ar' THEN COALESCE(NULLIF(b.name2, ''), b.name)
          ELSE b.name
        END AS bank_name,
        TO_CHAR(r.recon_date, 'YYYY-MM-DD') AS recon_date,
        TO_CHAR(r.stmt_date_from, 'YYYY-MM-DD') AS stmt_date_from,
        TO_CHAR(r.stmt_date_to, 'YYYY-MM-DD') AS stmt_date_to,
        r.status_code,
        r.unmatched_amount::float8 AS unmatched_amount
      FROM public.org_fin_bank_recon_mst r
      JOIN public.org_fin_bank_acct_mst b
        ON b.tenant_org_id = r.tenant_org_id
       AND b.id = r.bank_account_id
      WHERE r.tenant_org_id = ${tenantId}::uuid
        AND r.is_active = true
        AND r.rec_status = 1
      ORDER BY r.recon_date DESC, r.created_at DESC
      LIMIT 8
    `);
  }

  private static async listBranchOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT id::text AS id, branch_code AS code, name, name2
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY COALESCE(rec_order, 999999), created_at DESC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listSupplierOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT id::text AS id, supplier_code AS code, name, name2
      FROM public.org_fin_supp_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
        AND status_code = 'ACTIVE'
      ORDER BY supplier_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listUsageCodeOptions(locale: 'en' | 'ar'): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT
        usage_code_id::text AS id,
        usage_code AS code,
        usage_name AS name,
        usage_name2 AS name2
      FROM public.sys_fin_usage_code_cd
      WHERE is_active = true
        AND rec_status = 1
      ORDER BY usage_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listPayableAccountOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT
        a.id::text AS id,
        a.acct_code AS code,
        a.name,
        a.name2
      FROM public.org_fin_acct_mst a
      JOIN public.org_fin_usage_map_dtl m
        ON m.tenant_org_id = a.tenant_org_id
       AND m.account_id = a.id
       AND m.is_active = true
       AND m.rec_status = 1
      JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = m.usage_code_id
      WHERE a.tenant_org_id = ${tenantId}::uuid
        AND a.is_active = true
        AND a.rec_status = 1
        AND u.usage_code = 'AP_CONTROL'
      ORDER BY a.acct_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listOpenApInvoiceOptions(tenantId: string): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT
        id::text AS id,
        ap_inv_no || ' · ' || currency_code || ' · ' || open_amount::text AS label
      FROM public.org_fin_ap_inv_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
        AND open_amount > 0
        AND status_code IN ('POSTED', 'PARTIAL')
      ORDER BY invoice_date DESC, created_at DESC
    `);

    return rows.map((row) => ({ id: row.id, label: row.label }));
  }

  private static async listBankAccountOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT id::text AS id, bank_code AS code, name, name2
      FROM public.org_fin_bank_acct_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
        AND status_code = 'ACTIVE'
      ORDER BY bank_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listCashboxOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT id::text AS id, cashbox_code AS code, name, name2
      FROM public.org_fin_cashbox_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY cashbox_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listBankGlAccountOptions(
    tenantId: string,
    locale: 'en' | 'ar'
  ): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<LocalizedOptionRow[]>(Prisma.sql`
      SELECT
        a.id::text AS id,
        a.acct_code AS code,
        a.name,
        a.name2
      FROM public.org_fin_acct_mst a
      JOIN public.org_fin_usage_map_dtl m
        ON m.tenant_org_id = a.tenant_org_id
       AND m.account_id = a.id
       AND m.is_active = true
       AND m.rec_status = 1
      JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = m.usage_code_id
      WHERE a.tenant_org_id = ${tenantId}::uuid
        AND a.is_active = true
        AND a.rec_status = 1
        AND u.usage_code = 'BANK_ACCOUNT'
      ORDER BY a.acct_code ASC
    `);

    return this.mapLocalizedOptions(rows, locale);
  }

  private static async listPeriodOptions(tenantId: string): Promise<ErpLiteV2OptionItem[]> {
    const rows = await prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT
        id::text AS id,
        period_code || ' · ' || period_name AS label
      FROM public.org_fin_period_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND is_active = true
        AND rec_status = 1
      ORDER BY start_date DESC
    `);

    return rows.map((row) => ({ id: row.id, label: row.label }));
  }

  private static async requireTenantId(): Promise<string> {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Tenant context is required for ERP-Lite operations');
    }
    return tenantId;
  }

  private static async findUsageCodeId(
    usageCode: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<string> {
    const rows = await db.$queryRaw<{ usage_code_id: string }[]>(Prisma.sql`
      SELECT usage_code_id::text AS usage_code_id
      FROM public.sys_fin_usage_code_cd
      WHERE usage_code = ${usageCode}
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      throw new Error(`Required ERP-Lite usage code is missing: ${usageCode}`);
    }
    return row.usage_code_id;
  }

  private static async assertValidBranch(
    tenantId: string,
    branchId?: string | null,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_branches_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${branchId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected branch was not found for this tenant');
    }
  }

  private static async assertValidPayableAccount(
    tenantId: string,
    accountId?: string | null,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    if (!accountId) {
      return;
    }

    const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM public.org_fin_usage_map_dtl m
      JOIN public.sys_fin_usage_code_cd u
        ON u.usage_code_id = m.usage_code_id
      WHERE m.tenant_org_id = ${tenantId}::uuid
        AND m.account_id = ${accountId}::uuid
        AND m.is_active = true
        AND m.rec_status = 1
        AND u.usage_code = 'AP_CONTROL'
    `);

    if (!rows[0] || rows[0].count === 0) {
      throw new Error('Selected account is not an active AP control account for this tenant');
    }
  }

  private static async assertValidTenantAccount(
    tenantId: string,
    accountId: string,
    message: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_acct_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${accountId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error(message);
    }
  }

  private static async assertValidPurchaseOrder(
    tenantId: string,
    poId: string | null | undefined,
    supplierId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    if (!poId) {
      return;
    }

    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_po_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${poId}::uuid
        AND supplier_id = ${supplierId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected purchase order was not found for this supplier');
    }
  }

  private static async assertValidSettlementSource(
    tenantId: string,
    settlementCode: 'BANK' | 'CASH',
    bankAccountId: string | null | undefined,
    cashboxId: string | null | undefined,
    currencyCode: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    if (settlementCode === 'BANK') {
      if (!bankAccountId || cashboxId) {
        throw new Error('Bank settlement requires a bank account and must not use a cash box');
      }

      const bankAccount = await this.requireActiveBankAccount(tenantId, bankAccountId, db);
      if (bankAccount.currency_code !== currencyCode.trim()) {
        throw new Error('Selected bank account currency must match the AP payment currency');
      }
      return;
    }

    if (!cashboxId || bankAccountId) {
      throw new Error('Cash settlement requires a cash box and must not use a bank account');
    }

    const cashbox = await this.requireActiveCashbox(tenantId, cashboxId, db);
    if (cashbox.currency_code !== currencyCode.trim()) {
      throw new Error('Selected cash box currency must match the AP payment currency');
    }
  }

  private static async assertValidPeriod(
    tenantId: string,
    periodId?: string | null,
    db: PrismaSqlExecutor = prisma
  ): Promise<void> {
    if (!periodId) {
      return;
    }

    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id::text AS id
      FROM public.org_fin_period_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${periodId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new Error('Selected accounting period was not found for this tenant');
    }
  }

  private static async requireActiveSupplier(
    tenantId: string,
    supplierId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<SupplierValidationRow> {
    const rows = await db.$queryRaw<SupplierValidationRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        branch_id::text AS branch_id,
        payable_acct_id::text AS payable_acct_id,
        currency_code,
        status_code,
        posting_hold
      FROM public.org_fin_supp_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${supplierId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const supplier = rows[0];
    if (!supplier || supplier.status_code !== 'ACTIVE') {
      throw new Error('Selected supplier is not active for this tenant');
    }
    return supplier;
  }

  private static async requireOpenApInvoice(
    tenantId: string,
    invoiceId: string,
    supplierId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<ApInvoiceValidationRow> {
    const rows = await db.$queryRaw<ApInvoiceValidationRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        supplier_id::text AS supplier_id,
        branch_id::text AS branch_id,
        currency_code,
        open_amount::float8 AS open_amount,
        status_code
      FROM public.org_fin_ap_inv_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${invoiceId}::uuid
        AND supplier_id = ${supplierId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const invoice = rows[0];
    if (!invoice || !['POSTED', 'PARTIAL'].includes(invoice.status_code) || invoice.open_amount <= 0) {
      throw new Error('Selected AP invoice is not open for payment');
    }
    return invoice;
  }

  private static async requireActiveBankAccount(
    tenantId: string,
    bankAccountId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<BankAccountValidationRow> {
    const rows = await db.$queryRaw<BankAccountValidationRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        branch_id::text AS branch_id,
        currency_code,
        status_code
      FROM public.org_fin_bank_acct_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${bankAccountId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const bankAccount = rows[0];
    if (!bankAccount || bankAccount.status_code !== 'ACTIVE') {
      throw new Error('Selected bank account is not active for this tenant');
    }
    return bankAccount;
  }

  private static async requireActiveCashbox(
    tenantId: string,
    cashboxId: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<CashboxValidationRow> {
    const rows = await db.$queryRaw<CashboxValidationRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        branch_id::text AS branch_id,
        currency_code
      FROM public.org_fin_cashbox_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${cashboxId}::uuid
        AND is_active = true
        AND rec_status = 1
      LIMIT 1
    `);

    const cashbox = rows[0];
    if (!cashbox) {
      throw new Error('Selected cash box was not found for this tenant');
    }
    return cashbox;
  }

  private static async generateSequentialNo(
    tenantId: string,
    prefix: string,
    columnName: string,
    tableName: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<string> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const pattern = `${prefix}-${year}${month}%`;

    const counts = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM ${Prisma.raw(`public.${tableName}`)}
      WHERE tenant_org_id = ${tenantId}::uuid
        AND ${Prisma.raw(columnName)} LIKE ${pattern}
    `);

    const nextNumber = String((counts[0]?.count ?? 0) + 1).padStart(5, '0');
    return `${prefix}-${year}${month}-${nextNumber}`;
  }

  private static mapLocalizedOptions(
    rows: LocalizedOptionRow[],
    locale: 'en' | 'ar'
  ): ErpLiteV2OptionItem[] {
    return rows.map((row) => {
      const localizedName =
        locale === 'ar'
          ? row.name2?.trim() || row.name?.trim() || row.code?.trim() || row.id
          : row.name?.trim() || row.name2?.trim() || row.code?.trim() || row.id;

      return {
        id: row.id,
        label: row.code ? `${row.code} · ${localizedName}` : localizedName,
      };
    });
  }

  private static addDays(date: string, days: number): string {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  private static roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }

  private static assertPositiveAmount(value: number, field: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${field} must be greater than zero`);
    }
  }

  private static assertNonNegativeAmount(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${field} must be zero or greater`);
    }
  }

  private static assertNonNegativeInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative whole number`);
    }
  }

  private static assertRequiredString(value: string | null | undefined, field: string): void {
    if (!value || !value.trim()) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
