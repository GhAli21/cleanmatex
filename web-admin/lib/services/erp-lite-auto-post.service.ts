import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import {
  ERP_LITE_TXN_EVENT_CODES,
  type ErpLiteTxnEventCode,
} from '@/lib/constants/erp-lite-posting';
import type {
  ErpLiteAutoPostDispatchResult,
  ErpLiteAutoPostPolicy,
  ErpLiteExpenseAutoPostInput,
  ErpLiteInvoiceAutoPostInput,
  ErpLitePettyCashAutoPostInput,
  ErpLitePaymentAutoPostInput,
  ErpLiteRefundAutoPostInput,
} from '@/lib/types/erp-lite-auto-post';
import type { ErpLitePostingRequest } from '@/lib/types/erp-lite-posting';
import { ErpLitePostingEngineService } from '@/lib/services/erp-lite-posting-engine.service';
import { canAccess, FEATURE_FLAG_KEYS } from '@/lib/services/feature-flags.service';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaSqlExecutor = Pick<typeof prisma, '$queryRaw'>;

interface AutoPostPolicyRow {
  auto_post_id: string;
  pkg_id: string;
  policy_ver: number;
  txn_event_code: string;
  is_enabled: boolean;
  blocking_mode: string;
  required_success: boolean;
  retry_allowed: boolean;
  repost_allowed: boolean;
  failure_action_code: string;
  package_code: string;
  package_version_no: number;
}

/**
 * Phase 5 governed auto-post adapter.
 *
 * This service does not own posting logic. It only translates approved
 * business events into ERP-Lite posting requests and enforces HQ policy lookup
 * before delegating to the Phase 4 posting engine.
 */
export class ErpLiteAutoPostService {
  static async dispatchInvoiceCreated(
    input: ErpLiteInvoiceAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildInvoicePostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request);
    });
  }

  static async dispatchInvoiceCreatedInTransaction(
    tx: PrismaTx,
    input: ErpLiteInvoiceAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildInvoicePostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request, tx);
    });
  }

  static async dispatchPaymentReceived(
    input: ErpLitePaymentAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildPaymentPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request);
    });
  }

  static async dispatchPaymentReceivedInTransaction(
    tx: PrismaTx,
    input: ErpLitePaymentAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildPaymentPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request, tx);
    });
  }

  static async dispatchRefundIssued(
    input: ErpLiteRefundAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildRefundPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request);
    });
  }

  static async dispatchRefundIssuedInTransaction(
    tx: PrismaTx,
    input: ErpLiteRefundAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildRefundPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request, tx);
    });
  }

  static async dispatchExpenseRecorded(
    input: ErpLiteExpenseAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildExpensePostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request);
    });
  }

  static async dispatchExpenseRecordedInTransaction(
    tx: PrismaTx,
    input: ErpLiteExpenseAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildExpensePostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request, tx);
    });
  }

  static async dispatchPettyCashTransaction(
    input: ErpLitePettyCashAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildPettyCashPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request);
    });
  }

  static async dispatchPettyCashTransactionInTransaction(
    tx: PrismaTx,
    input: ErpLitePettyCashAutoPostInput
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantId = await this.resolveTenantId(input.tenant_org_id);
    const request = this.buildPettyCashPostingRequest(input, tenantId);

    return withTenantContext(tenantId, async () => {
      return this.dispatchRequest(request, tx);
    });
  }

  static buildInvoicePostingRequest(
    input: ErpLiteInvoiceAutoPostInput,
    tenantOrgId: string
  ): ErpLitePostingRequest {
    return {
      tenant_org_id: tenantOrgId,
      branch_id: input.branch_id ?? null,
      txn_event_code: ERP_LITE_TXN_EVENT_CODES.ORDER_INVOICED,
      source_module_code: 'BILLING',
      source_doc_type_code: 'INVOICE',
      source_doc_id: input.invoice_id,
      source_doc_no: input.invoice_no ?? null,
      journal_date: input.invoice_date,
      posting_date: input.invoice_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts: {
        net_amount: this.roundAmount(input.subtotal - Number(input.discount_amount ?? 0)),
        tax_amount: this.roundAmount(
          Number(input.tax_amount ?? 0) + Number(input.vat_amount ?? 0)
        ),
        gross_amount: this.roundAmount(input.total_amount),
        discount_amount: this.roundAmount(input.discount_amount ?? 0),
        delivery_fee_amount: 0,
        rounding_amount: this.roundAmount(
          Number(input.total_amount) -
            (Number(input.subtotal ?? 0) -
              Number(input.discount_amount ?? 0) +
              Number(input.tax_amount ?? 0) +
              Number(input.vat_amount ?? 0))
        ),
      },
      dimensions: {
        branch_id: input.branch_id ?? null,
      },
      meta: {
        created_by: input.created_by ?? null,
        source_context: 'invoice_created',
        payload_version: 'phase5-v1',
      },
    };
  }

  static buildPaymentPostingRequest(
    input: ErpLitePaymentAutoPostInput,
    tenantOrgId: string
  ): ErpLitePostingRequest {
    const txnEventCode = this.resolvePaymentTxnEventCode(input);

    return {
      tenant_org_id: tenantOrgId,
      branch_id: input.branch_id ?? null,
      txn_event_code: txnEventCode,
      source_module_code: 'PAYMENTS',
      source_doc_type_code: 'PAYMENT',
      source_doc_id: input.payment_id,
      source_doc_no: null,
      journal_date: input.payment_date,
      posting_date: input.payment_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts: {
        net_amount: this.roundAmount(input.paid_amount),
        tax_amount: this.roundAmount(
          Number(input.tax_amount ?? 0) + Number(input.vat_amount ?? 0)
        ),
        gross_amount: this.roundAmount(input.paid_amount),
        discount_amount: this.roundAmount(input.discount_amount ?? 0),
        delivery_fee_amount: 0,
        rounding_amount: 0,
      },
      dimensions: {
        branch_id: input.branch_id ?? null,
      },
      meta: {
        created_by: input.created_by ?? null,
        payment_method_code: input.payment_method_code,
        source_context: 'payment_received',
        payload_version: 'phase5-v1',
      },
    };
  }

  static buildRefundPostingRequest(
    input: ErpLiteRefundAutoPostInput,
    tenantOrgId: string
  ): ErpLitePostingRequest {
    return {
      tenant_org_id: tenantOrgId,
      branch_id: input.branch_id ?? null,
      txn_event_code: ERP_LITE_TXN_EVENT_CODES.REFUND_ISSUED,
      source_module_code: 'PAYMENTS',
      source_doc_type_code: 'PAYMENT_REFUND',
      source_doc_id: input.refund_payment_id,
      source_doc_no: null,
      journal_date: input.refund_date,
      posting_date: input.refund_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts: {
        net_amount: this.roundAmount(
          Number(input.refund_amount) -
            Number(input.tax_amount ?? 0) -
            Number(input.vat_amount ?? 0)
        ),
        tax_amount: this.roundAmount(
          Number(input.tax_amount ?? 0) + Number(input.vat_amount ?? 0)
        ),
        gross_amount: this.roundAmount(input.refund_amount),
        discount_amount: this.roundAmount(input.discount_amount ?? 0),
        delivery_fee_amount: 0,
        rounding_amount: 0,
      },
      dimensions: {
        branch_id: input.branch_id ?? null,
      },
      meta: {
        created_by: input.created_by ?? null,
        payment_method_code: input.payment_method_code,
        source_context: `refund_of:${input.original_payment_id}`,
        payload_version: 'phase5-v1',
      },
    };
  }

  static buildExpensePostingRequest(
    input: ErpLiteExpenseAutoPostInput,
    tenantOrgId: string
  ): ErpLitePostingRequest {
    return {
      tenant_org_id: tenantOrgId,
      branch_id: input.branch_id ?? null,
      txn_event_code: ERP_LITE_TXN_EVENT_CODES.EXPENSE_RECORDED,
      source_module_code: 'ERP_LITE_EXPENSES',
      source_doc_type_code: 'EXPENSE',
      source_doc_id: input.expense_id,
      source_doc_no: input.expense_no,
      journal_date: input.expense_date,
      posting_date: input.expense_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts: {
        net_amount: this.roundAmount(input.subtotal_amount),
        tax_amount: this.roundAmount(input.tax_amount ?? 0),
        gross_amount: this.roundAmount(input.total_amount),
        discount_amount: 0,
        delivery_fee_amount: 0,
        rounding_amount: 0,
      },
      dimensions: {
        branch_id: input.branch_id ?? null,
      },
      meta: {
        created_by: input.created_by ?? null,
        payment_method_code:
          input.settlement_code === 'BANK'
            ? PAYMENT_METHODS.BANK_TRANSFER
            : PAYMENT_METHODS.CASH,
        source_context: 'expense_recorded',
        payload_version: 'phase7-v1',
      },
    };
  }

  static buildPettyCashPostingRequest(
    input: ErpLitePettyCashAutoPostInput,
    tenantOrgId: string
  ): ErpLitePostingRequest {
    return {
      tenant_org_id: tenantOrgId,
      branch_id: input.branch_id ?? null,
      txn_event_code:
        input.txn_type_code === 'TOPUP'
          ? ERP_LITE_TXN_EVENT_CODES.PETTY_CASH_TOPUP
          : ERP_LITE_TXN_EVENT_CODES.PETTY_CASH_SPENT,
      source_module_code: 'ERP_LITE_EXPENSES',
      source_doc_type_code: 'PETTY_CASH_TXN',
      source_doc_id: input.cash_txn_id,
      source_doc_no: input.txn_no,
      journal_date: input.txn_date,
      posting_date: input.txn_date,
      currency_code: input.currency_code,
      exchange_rate: Number(input.exchange_rate ?? 1),
      amounts: {
        net_amount: this.roundAmount(input.amount_total),
        tax_amount: 0,
        gross_amount: this.roundAmount(input.amount_total),
        discount_amount: 0,
        delivery_fee_amount: 0,
        rounding_amount: 0,
      },
      dimensions: {
        branch_id: input.branch_id ?? null,
      },
      meta: {
        created_by: input.created_by ?? null,
        source_context: `petty_cash:${input.txn_type_code.toLowerCase()}:${input.cashbox_id}`,
        payload_version: 'phase7-v1',
      },
    };
  }

  static resolvePaymentTxnEventCode(
    input: Pick<ErpLitePaymentAutoPostInput, 'order_id' | 'payment_method_code'>
  ): ErpLiteTxnEventCode {
    if (!input.order_id) {
      return ERP_LITE_TXN_EVENT_CODES.PAYMENT_RECEIVED;
    }

    switch (input.payment_method_code) {
      case PAYMENT_METHODS.CASH:
      case PAYMENT_METHODS.CHECK:
      case PAYMENT_METHODS.PAY_ON_COLLECTION:
        return ERP_LITE_TXN_EVENT_CODES.ORDER_SETTLED_CASH;
      case PAYMENT_METHODS.CARD:
      case PAYMENT_METHODS.BANK_TRANSFER:
      case PAYMENT_METHODS.MOBILE_PAYMENT:
      case PAYMENT_METHODS.HYPERPAY:
      case PAYMENT_METHODS.PAYTABS:
      case PAYMENT_METHODS.STRIPE:
        return ERP_LITE_TXN_EVENT_CODES.ORDER_SETTLED_CARD;
      default:
        return ERP_LITE_TXN_EVENT_CODES.PAYMENT_RECEIVED;
    }
  }

  static async loadActivePolicy(
    tenantOrgId: string,
    txnEventCode: string,
    postingDate: string,
    db: PrismaSqlExecutor = prisma
  ): Promise<ErpLiteAutoPostPolicy | null> {
    const rows = await db.$queryRaw<AutoPostPolicyRow[]>(Prisma.sql`
      SELECT
        ap.auto_post_id,
        ap.pkg_id,
        ap.policy_ver,
        e.evt_code AS txn_event_code,
        ap.is_enabled,
        ap.blocking_mode,
        ap.required_success,
        ap.retry_allowed,
        ap.repost_allowed,
        ap.failure_action_code,
        p.pkg_code AS package_code,
        p.version_no AS package_version_no
      FROM public.sys_fin_auto_post_mst ap
      INNER JOIN public.sys_fin_gov_pkg_mst p
        ON p.pkg_id = ap.pkg_id
      INNER JOIN public.sys_fin_evt_cd e
        ON e.evt_id = ap.evt_id
      WHERE e.evt_code = ${txnEventCode}
        AND p.status_code = 'PUBLISHED'
        AND p.is_active = true
        AND p.rec_status = 1
        AND ap.status_code = 'ACTIVE'
        AND ap.is_active = true
        AND ap.rec_status = 1
        AND (ap.effective_from IS NULL OR ap.effective_from <= ${postingDate}::date)
        AND (ap.effective_to IS NULL OR ap.effective_to >= ${postingDate}::date)
      ORDER BY ap.policy_ver DESC, p.version_no DESC
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      logger.warn('ERP-Lite auto-post policy not found', {
        tenantOrgId,
        txnEventCode,
        postingDate,
      });
      return null;
    }

    return row;
  }

  private static async dispatchRequest(
    request: ErpLitePostingRequest,
    tx?: PrismaTx
  ): Promise<ErpLiteAutoPostDispatchResult> {
    const tenantOrgId = request.tenant_org_id;
    if (tenantOrgId) {
      const erpLiteEnabled = await canAccess(tenantOrgId, FEATURE_FLAG_KEYS.ERP_LITE_ENABLED);
      if (!erpLiteEnabled) {
        logger.info('ERP-Lite auto-post skipped: erp_lite_enabled is false for tenant', {
          feature: 'erp-lite',
          action: 'auto-post-skip',
          tenantId: tenantOrgId,
          txn_event_code: request.txn_event_code,
        });
        return {
          status: 'skipped',
          txn_event_code: request.txn_event_code as ErpLiteTxnEventCode,
          request,
          skip_reason: 'FEATURE_NOT_ENABLED',
        };
      }
    }

    const policy = await this.loadActivePolicy(
      request.tenant_org_id!,
      request.txn_event_code,
      request.posting_date ?? request.journal_date,
      tx ?? prisma
    );

    if (!policy) {
      return {
        status: 'skipped',
        txn_event_code: request.txn_event_code as ErpLiteTxnEventCode,
        request,
        skip_reason: 'POLICY_NOT_FOUND',
      };
    }

    if (!policy.is_enabled) {
      return {
        status: 'skipped',
        txn_event_code: request.txn_event_code as ErpLiteTxnEventCode,
        policy,
        request,
        skip_reason: 'POLICY_DISABLED',
      };
    }

    const executeResult = tx
      ? await ErpLitePostingEngineService.executeInTransaction(tx, request)
      : await ErpLitePostingEngineService.execute(request);

    return {
      status: 'executed',
      txn_event_code: request.txn_event_code as ErpLiteTxnEventCode,
      policy,
      request,
      execute_result: executeResult,
    };
  }

  private static async resolveTenantId(inputTenantId?: string): Promise<string> {
    if (inputTenantId) {
      return inputTenantId;
    }

    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      throw new Error('Unauthorized: Tenant ID required');
    }

    return tenantId;
  }

  private static roundAmount(value: number): number {
    return Number(Number(value ?? 0).toFixed(4));
  }
}
