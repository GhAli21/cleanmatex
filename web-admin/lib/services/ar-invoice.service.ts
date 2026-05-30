import { Prisma, type org_invoice_mst } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import { emitEventTx } from '@/lib/services/outbox.service';
import { addMoney, subMoney } from '@/lib/utils/money';
import {
  AR_ADJUSTMENT_STATUSES,
  AR_ADJUSTMENT_TYPES,
  AR_ALLOCATION_OUTCOMES,
  AR_DUE_DATE_SOURCES,
  AR_INVOICE_DOC_TYPES,
  AR_INVOICE_STATUSES,
  AR_INVOICE_TYPES,
  AR_LEDGER_ENTRY_SIDES,
  AR_LEDGER_MOVEMENTS,
  AR_SENSITIVE_APPROVAL_ACTIONS,
  deriveArInvoiceStatus,
  isArInvoiceOpenBalanceStatus,
  normalizeArInvoiceStatus,
} from '@/lib/constants/ar-invoice';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';
import { assertBlockingInvoiceAutoPostSucceeded } from '@/lib/services/erp-lite-auto-post.util';
import type {
  ArAgingCustomerRow,
  ArCustomerBalance,
  ArCustomerBalanceRow,
  ArCustomerLedgerEntry,
  ArInvoiceHubStats,
  ArCustomerStatement,
  ArInvoiceAdjustment,
  ArInvoiceDetail,
  ArInvoiceLine,
  ArInvoiceOrderLink,
  ArInvoicePaymentAllocation,
  ArInvoiceStatusHistoryEntry,
  ArStatementLine,
} from '@/lib/types/ar-invoice';
import type {
  AllocateArPaymentInput,
  ApproveSensitiveArInvoiceInput,
  ArAgingQuery,
  ArInvoiceListQuery,
  ArLedgerQuery,
  ReverseArPaymentAllocationInput,
  ArStatementQuery,
  CreateArInvoiceFromOrdersInput,
  CreateArInvoiceInput,
  CreateCreditNoteInput,
  CreateDebitNoteInput,
  IssueArInvoiceInput,
  UpdateArInvoiceInput,
  VoidArInvoiceInput,
  WriteOffArInvoiceInput,
} from '@/lib/validations/ar-invoice-schemas';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type PrismaSqlExecutor = Pick<typeof prisma, '$queryRaw'>;
type ArInvoiceReader = Pick<PrismaTx, 'org_invoice_mst'>;

interface ArActorContext {
  tenantId?: string;
  userId?: string | null;
  userName?: string | null;
}

interface IdempotentResult<T> {
  resourceId: string;
  data: T;
}

const IDEMPOTENCY_TTL_HOURS = 24;

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function calculateOutstandingAmount(totalAmount: number, paidAmount: number): number {
  return Math.max(0, totalAmount - paidAmount);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function normalizeDateOnly(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function getIdempotencyExpiryAt(now = new Date()): Date {
  return new Date(now.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
}

function getApprovalActionForAdjustment(typeCode: string): string | null {
  switch (typeCode) {
    case AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT:
      return AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_CREDIT_MEMO;
    case AR_ADJUSTMENT_TYPES.DEBIT_ADJUSTMENT:
      return AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_DEBIT_NOTE;
    case AR_ADJUSTMENT_TYPES.WRITE_OFF:
      return AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_WRITE_OFF;
    default:
      return null;
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function resolveTenantId(inputTenantId?: string): Promise<string> {
  const tenantId = inputTenantId ?? (await getTenantIdFromSession());
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }
  return tenantId;
}

async function nextArInvoiceNumber(
  tenantOrgId: string,
  db: PrismaSqlExecutor = prisma
): Promise<string> {
  const rows = await db.$queryRaw<Array<{ doc_no: string | null }>>(Prisma.sql`
    SELECT fn_next_fin_doc_no(${tenantOrgId}::uuid, ${AR_INVOICE_DOC_TYPES.AR_INV}) AS doc_no
  `);
  const invoiceNo = rows[0]?.doc_no;
  if (!invoiceNo) {
    throw new Error('Failed to generate AR invoice number.');
  }
  return invoiceNo;
}

async function nextScopedSequence(
  tx: PrismaTx,
  table:
    | 'org_invoice_payments_dtl'
    | 'org_invoice_adjustments_dtl'
    | 'org_customer_ar_ledger_dtl',
  tenantId: string,
  scope: { invoiceId?: string; customerId?: string }
): Promise<number> {
  if (table === 'org_invoice_payments_dtl' && scope.invoiceId) {
    const row = await tx.org_invoice_payments_dtl.findFirst({
      where: { tenant_org_id: tenantId, invoice_id: scope.invoiceId },
      orderBy: { allocation_no: 'desc' },
      select: { allocation_no: true },
    });
    return (row?.allocation_no ?? 0) + 1;
  }

  if (table === 'org_invoice_adjustments_dtl' && scope.invoiceId) {
    const row = await tx.org_invoice_adjustments_dtl.findFirst({
      where: { tenant_org_id: tenantId, invoice_id: scope.invoiceId },
      orderBy: { adjustment_no: 'desc' },
      select: { adjustment_no: true },
    });
    return (row?.adjustment_no ?? 0) + 1;
  }

  if (table === 'org_customer_ar_ledger_dtl' && scope.customerId) {
    const row = await tx.org_customer_ar_ledger_dtl.findFirst({
      where: { tenant_org_id: tenantId, customer_id: scope.customerId },
      orderBy: { entry_no: 'desc' },
      select: { entry_no: true },
    });
    return (row?.entry_no ?? 0) + 1;
  }

  throw new Error(`Unsupported scoped sequence request for ${table}.`);
}

async function recordStatusHistoryTx(
  tx: PrismaTx,
  input: {
    tenantId: string;
    invoiceId: string;
    fromStatus?: string | null;
    toStatus: string;
    actionCd?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
    userId?: string | null;
  }
): Promise<void> {
  await tx.org_invoice_status_history_dtl.create({
    data: {
      tenant_org_id: input.tenantId,
      invoice_id: input.invoiceId,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus,
      action_cd: input.actionCd ?? null,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    },
  });
}

async function appendLedgerEntryTx(
  tx: PrismaTx,
  input: {
    tenantId: string;
    customerId: string;
    currencyCode: string;
    amount: number;
    entrySide: string;
    movementCd: string;
    invoiceId?: string | null;
    paymentAllocId?: string | null;
    adjustmentId?: string | null;
    voucherId?: string | null;
    refDocNo?: string | null;
    eventAt?: Date;
    metadata?: Record<string, unknown>;
    userId?: string | null;
  }
): Promise<void> {
  const previous = await tx.org_customer_ar_ledger_dtl.findFirst({
    where: {
      tenant_org_id: input.tenantId,
      customer_id: input.customerId,
    },
    orderBy: [
      { event_at: 'desc' },
      { entry_no: 'desc' },
    ],
    select: { running_balance: true },
  });

  const priorBalance = Number(previous?.running_balance ?? 0);
  const runningBalance =
    input.entrySide === AR_LEDGER_ENTRY_SIDES.DEBIT
      ? priorBalance + input.amount
      : Math.max(0, priorBalance - input.amount);

  const entryNo = await nextScopedSequence(tx, 'org_customer_ar_ledger_dtl', input.tenantId, {
    customerId: input.customerId,
  });

  await tx.org_customer_ar_ledger_dtl.create({
    data: {
      tenant_org_id: input.tenantId,
      customer_id: input.customerId,
      invoice_id: input.invoiceId ?? null,
      payment_alloc_id: input.paymentAllocId ?? null,
      adjustment_id: input.adjustmentId ?? null,
      voucher_id: input.voucherId ?? null,
      entry_no: entryNo,
      movement_cd: input.movementCd,
      entry_side: input.entrySide,
      amount: input.amount,
      running_balance: runningBalance,
      currency_code: input.currencyCode,
      event_at: input.eventAt ?? new Date(),
      ref_doc_no: input.refDocNo ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    },
  });
}

async function withIdempotency<T>(
  tx: PrismaTx,
  input: {
    tenantId: string;
    userId?: string | null;
    key?: string | null;
    resourceType: string;
    producer: () => Promise<IdempotentResult<T>>;
  }
): Promise<T> {
  if (!input.key) {
    return (await input.producer()).data;
  }

  const existing = await tx.org_idempotency_keys.findFirst({
    where: {
      tenant_org_id: input.tenantId,
      key: input.key,
      resource_type: input.resourceType,
    },
  });

  if (existing?.response_cache) {
    return existing.response_cache as T;
  }

  const result = await input.producer();
  const expiresAt = getIdempotencyExpiryAt();
  await tx.org_idempotency_keys.upsert({
    where: {
      tenant_org_id_key_resource_type: {
        tenant_org_id: input.tenantId,
        key: input.key,
        resource_type: input.resourceType,
      },
    },
    create: {
      tenant_org_id: input.tenantId,
      key: input.key,
      resource_type: input.resourceType,
      resource_id: result.resourceId,
      response_cache: result.data as unknown as Prisma.InputJsonValue,
      created_at: new Date(),
      expires_at: expiresAt,
    },
    update: {
      resource_id: result.resourceId,
      response_cache: result.data as unknown as Prisma.InputJsonValue,
      expires_at: expiresAt,
    },
  });

  return result.data;
}

/**
 * Ensures legacy order-driven invoice creation flows also produce the canonical
 * AR child records required by v1+ reports, audit tabs, and later V2
 * operations. This keeps older callers working while we consolidate writes.
 */
export async function ensureCanonicalArInvoiceArtifactsTx(
  tx: PrismaTx,
  input: {
    tenantId: string;
    invoiceId: string;
    orderId?: string | null;
    customerId?: string | null;
    branchId?: string | null;
    invoiceNo?: string | null;
    currencyCode?: string | null;
    currencyExRate?: number | null;
    invoiceDate?: Date | null;
    dueDate?: Date | null;
    status?: string | null;
    totalAmount: number;
    paidAmount?: number;
    outstandingAmount?: number;
    userId?: string | null;
  }
): Promise<void> {
  const normalizedStatus = normalizeArInvoiceStatus(input.status);
  const currencyCode = input.currencyCode ?? ORDER_DEFAULTS.CURRENCY;
  const outstandingAmount =
    input.outstandingAmount ??
    calculateOutstandingAmount(input.totalAmount, Number(input.paidAmount ?? 0));

  const [orderLinkCount, lineCount, historyCount, ledgerEntry, order] = await Promise.all([
    input.orderId
      ? tx.org_invoice_orders_dtl.count({
          where: {
            tenant_org_id: input.tenantId,
            invoice_id: input.invoiceId,
            order_id: input.orderId,
          },
        })
      : Promise.resolve(0),
    tx.org_invoice_lines_dtl.count({
      where: {
        tenant_org_id: input.tenantId,
        invoice_id: input.invoiceId,
      },
    }),
    tx.org_invoice_status_history_dtl.count({
      where: {
        tenant_org_id: input.tenantId,
        invoice_id: input.invoiceId,
      },
    }),
    input.customerId
      ? tx.org_customer_ar_ledger_dtl.findFirst({
          where: {
            tenant_org_id: input.tenantId,
            customer_id: input.customerId,
            invoice_id: input.invoiceId,
            movement_cd: AR_LEDGER_MOVEMENTS.INVOICE_ISSUED,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    input.orderId
      ? tx.org_orders_mst.findUnique({
          where: { id: input.orderId },
          select: {
            id: true,
            order_no: true,
            total: true,
            paid_amount: true,
            outstanding_amount: true,
            // Selected for defense-in-depth: cash-paid orders must not produce
            // an INVOICE_ISSUED AR ledger debit even if a caller creates an
            // org_invoice_mst row for them (ADR_ar_invoice_is_receivable_only.md).
            payment_type_code: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (input.orderId && order && orderLinkCount === 0) {
    const orderOutstanding = toNumber(
      order.outstanding_amount ??
        calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))
    );

    await tx.org_invoice_orders_dtl.create({
      data: {
        tenant_org_id: input.tenantId,
        invoice_id: input.invoiceId,
        order_id: input.orderId,
        order_total_amount: toNumber(order.total),
        invoiced_amount: input.totalAmount,
        paid_before_amount: toNumber(order.paid_amount),
        credit_before_amount: 0,
        outstanding_amount: orderOutstanding,
        allocation_policy: 'REMAINING_ONLY',
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      },
    });
  }

  if (lineCount === 0) {
    await tx.org_invoice_lines_dtl.create({
      data: {
        tenant_org_id: input.tenantId,
        invoice_id: input.invoiceId,
        line_no: 1,
        line_type: 'ORDER_SUMMARY',
        source_type: input.orderId ? 'ORDER' : 'MANUAL',
        source_order_id: input.orderId ?? null,
        source_order_item_id: null,
        description: input.orderId
          ? `Order ${order?.order_no ?? input.orderId}`
          : `Invoice ${input.invoiceNo ?? input.invoiceId}`,
        description2: null,
        quantity: 1,
        unit_price: input.totalAmount,
        subtotal_amount: input.totalAmount,
        discount_amount: 0,
        taxable_amount: input.totalAmount,
        tax_rate: null,
        tax_amount: 0,
        total_amount: input.totalAmount,
        currency_code: currencyCode,
        currency_ex_rate: input.currencyExRate ?? 1,
        metadata: {
          source_flow: 'legacy_invoice_bridge',
          order_no: order?.order_no ?? null,
        } as Prisma.InputJsonValue,
        created_by: input.userId ?? null,
        updated_by: input.userId ?? null,
      },
    });
  }

  if (historyCount === 0) {
    await recordStatusHistoryTx(tx, {
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      toStatus: normalizedStatus,
      actionCd: 'LEGACY_BRIDGE_CREATE',
      metadata: {
        source_flow: 'legacy_invoice_bridge',
        issued_immediately: normalizedStatus !== AR_INVOICE_STATUSES.DRAFT,
      },
      userId: input.userId ?? null,
    });
  }

  // Defense-in-depth: AR ledger INVOICE_ISSUED debit only fires when the order
  // is genuinely a receivable. Cash/card/gateway orders with no outstanding
  // amount must never debit AR ledger, even if a legacy caller still creates
  // an org_invoice_mst row for them. See ADR_ar_invoice_is_receivable_only.md.
  const isReceivableInvoice =
    !input.orderId || // manual AR invoice (no source order) → always treat as receivable
    outstandingAmount > 0 ||
    order?.payment_type_code === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE ||
    order?.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;

  if (
    input.customerId &&
    !ledgerEntry &&
    normalizedStatus !== AR_INVOICE_STATUSES.DRAFT &&
    input.totalAmount > 0 &&
    isReceivableInvoice
  ) {
    await appendLedgerEntryTx(tx, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      currencyCode,
      amount: outstandingAmount > 0 ? outstandingAmount : input.totalAmount,
      entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
      movementCd: AR_LEDGER_MOVEMENTS.INVOICE_ISSUED,
      refDocNo: input.invoiceNo ?? null,
      eventAt: input.invoiceDate ?? new Date(),
      metadata: {
        source_flow: 'legacy_invoice_bridge',
        invoice_status: normalizedStatus,
      },
      userId: input.userId ?? null,
    });
  }
}

export async function allocateArPaymentTx(
  tx: PrismaTx,
  invoiceId: string,
  input: AllocateArPaymentInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withIdempotency(tx, {
    tenantId,
    userId,
    key: input.idempotency_key ?? null,
    resourceType: 'ar_invoice_allocate_payment',
    producer: async () => {
      const invoice = await tx.org_invoice_mst.findUnique({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
      });
      if (!invoice) throw new Error('AR invoice not found');
      if (!invoice.customer_id) throw new Error('Invoice has no customer for AR allocation.');

      const currentOutstanding = toNumber(
        invoice.outstanding_amount ??
          calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
      );
      // Allocation math via Decimal helpers — avoids 0.0001 drift on partial
      // allocations and overpayment splits.
      const appliedToInvoice = Math.min(currentOutstanding, input.allocated_amount);
      const unappliedCreditAmount = Math.max(0, subMoney(input.allocated_amount, appliedToInvoice).toNumber());
      const updatedPaidAmount = addMoney(toNumber(invoice.paid_amount), appliedToInvoice).toNumber();
      const allocationNo = await nextScopedSequence(tx, 'org_invoice_payments_dtl', tenantId, {
        invoiceId,
      });
      const allocationOutcome =
        unappliedCreditAmount > 0
          ? AR_ALLOCATION_OUTCOMES.UNAPPLIED_CREDIT
          : appliedToInvoice < currentOutstanding
            ? AR_ALLOCATION_OUTCOMES.PARTIAL
            : AR_ALLOCATION_OUTCOMES.APPLIED;

      const allocation = await tx.org_invoice_payments_dtl.create({
        data: {
          tenant_org_id: tenantId,
          invoice_id: invoiceId,
          payment_id: input.payment_id ?? null,
          voucher_id: input.voucher_id ?? null,
          allocation_no: allocationNo,
          allocation_outcome: allocationOutcome,
          allocated_amount: appliedToInvoice,
          unapplied_credit_amount: unappliedCreditAmount,
          applied_at: normalizeDateOnly(input.applied_at) ?? new Date(),
          metadata: { notes: input.notes } as Prisma.InputJsonValue,
          created_by: userId,
          updated_by: userId,
        },
      });

      const newStatus = deriveArInvoiceStatus({
        currentStatus: invoice.status,
        totalAmount: toNumber(invoice.total),
        paidAmount: updatedPaidAmount,
        dueDate: invoice.due_date,
      });

      await tx.org_invoice_mst.update({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
        data: {
          paid_amount: updatedPaidAmount,
          outstanding_amount: calculateOutstandingAmount(toNumber(invoice.total), updatedPaidAmount),
          status: newStatus,
          paid_at: newStatus === AR_INVOICE_STATUSES.PAID ? new Date() : undefined,
          paid_by: userId,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await recordStatusHistoryTx(tx, {
        tenantId,
        invoiceId,
        fromStatus: invoice.status,
        toStatus: newStatus,
        actionCd: 'ALLOCATE_PAYMENT',
        reason: input.notes ?? null,
        userId,
      });

      await appendLedgerEntryTx(tx, {
        tenantId,
        customerId: invoice.customer_id,
        invoiceId,
        paymentAllocId: allocation.id,
        voucherId: input.voucher_id ?? null,
        currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
        amount: appliedToInvoice,
        entrySide: AR_LEDGER_ENTRY_SIDES.CREDIT,
        movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_APPLIED,
        refDocNo: invoice.invoice_no,
        metadata: { payment_id: input.payment_id, notes: input.notes },
        userId,
      });

      if (unappliedCreditAmount > 0) {
        await appendLedgerEntryTx(tx, {
          tenantId,
          customerId: invoice.customer_id,
          invoiceId,
          paymentAllocId: allocation.id,
          voucherId: input.voucher_id ?? null,
          currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
          amount: unappliedCreditAmount,
          entrySide: AR_LEDGER_ENTRY_SIDES.CREDIT,
          movementCd: AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT,
          refDocNo: invoice.invoice_no,
          metadata: { payment_id: input.payment_id, notes: input.notes },
          userId,
        });
      }

      await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.AR_PAYMENT_ALLOCATED, 'ar_invoice', invoiceId, {
        invoice_id: invoiceId,
        invoice_no: invoice.invoice_no,
        payment_id: input.payment_id ?? null,
        voucher_id: input.voucher_id ?? null,
        allocated_amount: appliedToInvoice,
        unapplied_credit_amount: unappliedCreditAmount,
      });

      if (unappliedCreditAmount > 0) {
        await emitEventTx(
          tx,
          tenantId,
          OUTBOX_EVENT_TYPES.AR_OVERPAYMENT_CREDIT_CREATED,
          'ar_invoice',
          invoiceId,
          {
            invoice_id: invoiceId,
            invoice_no: invoice.invoice_no,
            payment_id: input.payment_id ?? null,
            voucher_id: input.voucher_id ?? null,
            unapplied_credit_amount: unappliedCreditAmount,
          }
        );
      }

      const detail = await getArInvoiceDetail(invoiceId, { tenantId });
      return { resourceId: allocation.id, data: detail };
    },
  });
}

export async function reverseArPaymentAllocationTx(
  tx: PrismaTx,
  invoiceId: string,
  allocationId: string,
  input: ReverseArPaymentAllocationInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withIdempotency(tx, {
    tenantId,
    userId,
    key: input.idempotency_key ?? null,
    resourceType: 'ar_invoice_reverse_payment_allocation',
    producer: async () => {
      const [invoice, allocation] = await Promise.all([
        tx.org_invoice_mst.findUnique({
          where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
        }),
        tx.org_invoice_payments_dtl.findFirst({
          where: {
            tenant_org_id: tenantId,
            id: allocationId,
            invoice_id: invoiceId,
          },
        }),
      ]);

      if (!invoice) throw new Error('AR invoice not found');
      if (!invoice.customer_id) throw new Error('Invoice has no customer for AR allocation reversal.');
      if (!allocation) throw new Error('AR payment allocation not found');
      if (allocation.reversed_at) throw new Error('This AR payment allocation has already been reversed.');

      const reversedAt = normalizeDateOnly(input.reversed_at) ?? new Date();
      const reversedAppliedAmount = toNumber(allocation.allocated_amount);
      const reversedCreditAmount = toNumber(allocation.unapplied_credit_amount);
      const updatedPaidAmount = Math.max(0, toNumber(invoice.paid_amount) - reversedAppliedAmount);
      const updatedOutstandingAmount = calculateOutstandingAmount(
        toNumber(invoice.total),
        updatedPaidAmount
      );
      const newStatus = deriveArInvoiceStatus({
        currentStatus: invoice.status,
        totalAmount: toNumber(invoice.total),
        paidAmount: updatedPaidAmount,
        dueDate: invoice.due_date,
      });

      await tx.org_invoice_payments_dtl.update({
        where: {
          id_tenant_org_id: {
            id: allocationId,
            tenant_org_id: tenantId,
          },
        },
        data: {
          allocation_outcome: AR_ALLOCATION_OUTCOMES.REVERSED,
          reversed_at: reversedAt,
          reversed_by: userId,
          reversal_reason: input.reason,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await tx.org_invoice_mst.update({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
        data: {
          paid_amount: updatedPaidAmount,
          outstanding_amount: updatedOutstandingAmount,
          status: newStatus,
          paid_at: newStatus === AR_INVOICE_STATUSES.PAID ? invoice.paid_at : null,
          paid_by: newStatus === AR_INVOICE_STATUSES.PAID ? invoice.paid_by : null,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await recordStatusHistoryTx(tx, {
        tenantId,
        invoiceId,
        fromStatus: invoice.status,
        toStatus: newStatus,
        actionCd: 'REVERSE_PAYMENT_ALLOCATION',
        reason: input.reason,
        metadata: {
          allocation_id: allocationId,
          reversed_at: reversedAt.toISOString(),
        },
        userId,
      });

      if (reversedAppliedAmount > 0) {
        await appendLedgerEntryTx(tx, {
          tenantId,
          customerId: invoice.customer_id,
          invoiceId,
          paymentAllocId: allocationId,
          voucherId: allocation.voucher_id ?? null,
          currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
          amount: reversedAppliedAmount,
          entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
          movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_REVERSED,
          refDocNo: invoice.invoice_no,
          metadata: {
            payment_id: allocation.payment_id,
            reversal_reason: input.reason,
          },
          userId,
        });
      }

      if (reversedCreditAmount > 0) {
        await appendLedgerEntryTx(tx, {
          tenantId,
          customerId: invoice.customer_id,
          invoiceId,
          paymentAllocId: allocationId,
          voucherId: allocation.voucher_id ?? null,
          currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
          amount: reversedCreditAmount,
          entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
          movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_REVERSED,
          refDocNo: invoice.invoice_no,
          metadata: {
            payment_id: allocation.payment_id,
            reversal_reason: input.reason,
            reversal_kind: 'UNAPPLIED_CREDIT',
          },
          userId,
        });
      }

      await emitEventTx(
        tx,
        tenantId,
        OUTBOX_EVENT_TYPES.AR_PAYMENT_ALLOCATION_REVERSED,
        'ar_invoice',
        invoiceId,
        {
          invoice_id: invoiceId,
          invoice_no: invoice.invoice_no,
          allocation_id: allocationId,
          payment_id: allocation.payment_id,
          voucher_id: allocation.voucher_id,
          reversed_allocated_amount: reversedAppliedAmount,
          reversed_unapplied_credit_amount: reversedCreditAmount,
        }
      );

      const detail = await getArInvoiceDetail(invoiceId, { tenantId });
      return { resourceId: allocationId, data: detail };
    },
  });
}

function mapInvoiceLine(row: {
  id: string;
  invoice_id: string;
  tenant_org_id: string;
  line_no: number;
  line_type: string;
  source_type: string | null;
  source_order_id: string | null;
  source_order_item_id: string | null;
  description: string;
  description2: string | null;
  quantity: Prisma.Decimal;
  unit_price: Prisma.Decimal;
  subtotal_amount: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  taxable_amount: Prisma.Decimal;
  tax_rate: Prisma.Decimal | null;
  tax_amount: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  currency_code: string;
  currency_ex_rate: Prisma.Decimal;
  metadata: Prisma.JsonValue;
}): ArInvoiceLine {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    tenant_org_id: row.tenant_org_id,
    line_no: row.line_no,
    line_type: row.line_type,
    source_type: row.source_type ?? undefined,
    source_order_id: row.source_order_id ?? undefined,
    source_order_item_id: row.source_order_item_id ?? undefined,
    description: row.description,
    description2: row.description2 ?? undefined,
    quantity: toNumber(row.quantity),
    unit_price: toNumber(row.unit_price),
    subtotal_amount: toNumber(row.subtotal_amount),
    discount_amount: toNumber(row.discount_amount),
    taxable_amount: toNumber(row.taxable_amount),
    tax_rate: row.tax_rate != null ? toNumber(row.tax_rate) : undefined,
    tax_amount: toNumber(row.tax_amount),
    total_amount: toNumber(row.total_amount),
    currency_code: row.currency_code,
    currency_ex_rate: toNumber(row.currency_ex_rate),
    metadata: parseJsonRecord(row.metadata),
  };
}

function mapOrderLink(row: {
  id: string;
  invoice_id: string;
  order_id: string;
  order_total_amount: Prisma.Decimal;
  invoiced_amount: Prisma.Decimal;
  paid_before_amount: Prisma.Decimal;
  credit_before_amount: Prisma.Decimal;
  outstanding_amount: Prisma.Decimal;
  allocation_policy: string;
}): ArInvoiceOrderLink {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    order_id: row.order_id,
    order_total_amount: toNumber(row.order_total_amount),
    invoiced_amount: toNumber(row.invoiced_amount),
    paid_before_amount: toNumber(row.paid_before_amount),
    credit_before_amount: toNumber(row.credit_before_amount),
    outstanding_amount: toNumber(row.outstanding_amount),
    allocation_policy: row.allocation_policy as ArInvoiceOrderLink['allocation_policy'],
  };
}

function mapAllocation(row: {
  id: string;
  invoice_id: string;
  payment_id: string | null;
  voucher_id: string | null;
  allocation_no: number;
  allocation_outcome: string;
  allocated_amount: Prisma.Decimal;
  unapplied_credit_amount: Prisma.Decimal;
  applied_at: Date;
  reversed_at: Date | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  metadata: Prisma.JsonValue;
}): ArInvoicePaymentAllocation {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    payment_id: row.payment_id ?? undefined,
    voucher_id: row.voucher_id ?? undefined,
    allocation_no: row.allocation_no,
    allocation_outcome: row.allocation_outcome as ArInvoicePaymentAllocation['allocation_outcome'],
    allocated_amount: toNumber(row.allocated_amount),
    unapplied_credit_amount: toNumber(row.unapplied_credit_amount),
    applied_at: row.applied_at.toISOString(),
    reversed_at: row.reversed_at?.toISOString(),
    reversed_by: row.reversed_by ?? undefined,
    reversal_reason: row.reversal_reason ?? undefined,
    metadata: parseJsonRecord(row.metadata),
  };
}

function mapAdjustment(row: {
  id: string;
  invoice_id: string;
  adjustment_no: number;
  adjustment_type_cd: string;
  adjustment_amount: Prisma.Decimal;
  status_cd: string;
  approval_action_cd: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  reason: string | null;
  metadata: Prisma.JsonValue;
}): ArInvoiceAdjustment {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    adjustment_no: row.adjustment_no,
    adjustment_type_cd: row.adjustment_type_cd as ArInvoiceAdjustment['adjustment_type_cd'],
    adjustment_amount: toNumber(row.adjustment_amount),
    status_cd: row.status_cd as ArInvoiceAdjustment['status_cd'],
    approval_action_cd: row.approval_action_cd as ArInvoiceAdjustment['approval_action_cd'],
    approved_at: row.approved_at?.toISOString(),
    approved_by: row.approved_by ?? undefined,
    reason: row.reason ?? undefined,
    metadata: parseJsonRecord(row.metadata),
  };
}

function mapHistory(row: {
  id: string;
  invoice_id: string;
  from_status: string | null;
  to_status: string;
  action_cd: string | null;
  reason: string | null;
  metadata: Prisma.JsonValue;
  created_at: Date;
  created_by: string | null;
}): ArInvoiceStatusHistoryEntry {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    from_status: row.from_status ? normalizeArInvoiceStatus(row.from_status) : undefined,
    to_status: normalizeArInvoiceStatus(row.to_status),
    action_cd: row.action_cd ?? undefined,
    reason: row.reason ?? undefined,
    metadata: parseJsonRecord(row.metadata),
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
  };
}

function mapLedger(row: {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  payment_alloc_id: string | null;
  adjustment_id: string | null;
  voucher_id: string | null;
  entry_no: number;
  movement_cd: string;
  entry_side: string;
  amount: Prisma.Decimal;
  running_balance: Prisma.Decimal;
  currency_code: string;
  event_at: Date;
  ref_doc_no: string | null;
  metadata: Prisma.JsonValue;
}): ArCustomerLedgerEntry {
  return {
    id: row.id,
    customer_id: row.customer_id,
    invoice_id: row.invoice_id ?? undefined,
    payment_alloc_id: row.payment_alloc_id ?? undefined,
    adjustment_id: row.adjustment_id ?? undefined,
    voucher_id: row.voucher_id ?? undefined,
    entry_no: row.entry_no,
    movement_cd: row.movement_cd as ArCustomerLedgerEntry['movement_cd'],
    entry_side: row.entry_side as ArCustomerLedgerEntry['entry_side'],
    amount: toNumber(row.amount),
    running_balance: toNumber(row.running_balance),
    currency_code: row.currency_code,
    event_at: row.event_at.toISOString(),
    ref_doc_no: row.ref_doc_no ?? undefined,
    metadata: parseJsonRecord(row.metadata),
  };
}

function mapInvoiceHeader(row: org_invoice_mst & {
  org_customers_mst?: { name: string | null; name2: string | null } | null;
  org_orders_mst?: { order_no: string | null } | null;
}): ArInvoiceDetail['invoice'] {
  const total = toNumber(row.total);
  const paidAmount = toNumber(row.paid_amount);
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    order_id: row.order_id ?? undefined,
    customer_id: row.customer_id ?? undefined,
    branch_id: row.branch_id ?? undefined,
    invoice_no: row.invoice_no,
    invoice_date: row.invoice_date?.toISOString().slice(0, 10),
    invoice_type_cd: (row.invoice_type_cd as ArInvoiceDetail['invoice']['invoice_type_cd']) ?? undefined,
    status: normalizeArInvoiceStatus(row.status),
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    tax: toNumber(row.tax),
    total,
    paid_amount: paidAmount,
    outstanding_amount: toNumber(row.outstanding_amount ?? calculateOutstandingAmount(total, paidAmount)),
    currency_code: row.currency_code ?? ORDER_DEFAULTS.CURRENCY,
    currency_ex_rate: toNumber(row.currency_ex_rate ?? 1),
    due_date: row.due_date?.toISOString().slice(0, 10),
    due_date_source_cd: (row.due_date_source_cd as ArInvoiceDetail['invoice']['due_date_source_cd']) ?? undefined,
    due_terms_days: row.due_terms_days ?? undefined,
    payment_terms: row.payment_terms ?? undefined,
    payment_method_code: row.payment_method_code ?? undefined,
    approval_required: row.approval_required ?? false,
    approval_action_cd: (row.approval_action_cd as ArInvoiceDetail['invoice']['approval_action_cd']) ?? undefined,
    approved_at: row.approved_at?.toISOString(),
    approved_by: row.approved_by ?? undefined,
    approval_notes: row.approval_notes ?? undefined,
    numbering_doc_type_cd: (row.numbering_doc_type_cd as ArInvoiceDetail['invoice']['numbering_doc_type_cd']) ?? undefined,
    numbering_seq_no: row.numbering_seq_no != null ? Number(row.numbering_seq_no) : undefined,
    issued_at: row.issued_at?.toISOString(),
    issued_by: row.issued_by ?? undefined,
    voided_at: row.voided_at?.toISOString(),
    voided_by: row.voided_by ?? undefined,
    void_reason: row.void_reason ?? undefined,
    customer_name: row.org_customers_mst?.name ?? undefined,
    customer_name2: row.org_customers_mst?.name2 ?? undefined,
    order_no: row.org_orders_mst?.order_no ?? undefined,
    metadata: parseJsonRecord(row.metadata),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at?.toISOString(),
  };
}

export async function listArInvoices(query: ArInvoiceListQuery, actor: ArActorContext = {}) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  return withTenantContext(tenantId, async () => {
    const where: Prisma.org_invoice_mstWhereInput = {
      tenant_org_id: tenantId,
    };

    if (query.status) where.status = normalizeArInvoiceStatus(query.status);
    if (query.invoice_type_cd) where.invoice_type_cd = query.invoice_type_cd;
    if (query.customer_id) where.customer_id = query.customer_id;
    if (query.order_id) where.order_id = query.order_id;
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.date_from || query.date_to) {
      where.invoice_date = {};
      if (query.date_from) where.invoice_date.gte = new Date(query.date_from);
      if (query.date_to) where.invoice_date.lte = new Date(query.date_to);
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { invoice_no: { contains: search, mode: 'insensitive' } },
        { customer_reference: { contains: search, mode: 'insensitive' } },
        { trans_desc: { contains: search, mode: 'insensitive' } },
        { org_customers_mst: { name: { contains: search, mode: 'insensitive' } } },
        { org_orders_mst: { order_no: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const sortBy = ['invoice_no', 'invoice_date', 'created_at', 'due_date', 'total', 'paid_amount', 'outstanding_amount', 'status']
      .includes(query.sort_by ?? '')
      ? (query.sort_by as keyof Prisma.org_invoice_mstOrderByWithRelationInput)
      : 'created_at';

    const [rows, total] = await Promise.all([
      prisma.org_invoice_mst.findMany({
        where,
        include: {
          org_customers_mst: { select: { name: true, name2: true } },
          org_orders_mst: { select: { order_no: true } },
        },
        orderBy: { [sortBy]: query.sort_order },
        skip: offset,
        take: limit,
      }),
      prisma.org_invoice_mst.count({ where }),
    ]);

    return {
      data: rows.map((row) => mapInvoiceHeader(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getArInvoiceHubStats(actor: ArActorContext = {}): Promise<ArInvoiceHubStats> {
  const tenantId = await resolveTenantId(actor.tenantId);

  return withTenantContext(tenantId, async () => {
    const [total_invoices, draft_invoices, open_invoices, paid_invoices, overdue_invoices, outstanding] =
      await Promise.all([
        prisma.org_invoice_mst.count({
          where: { tenant_org_id: tenantId },
        }),
        prisma.org_invoice_mst.count({
          where: { tenant_org_id: tenantId, status: AR_INVOICE_STATUSES.DRAFT },
        }),
        prisma.org_invoice_mst.count({
          where: {
            tenant_org_id: tenantId,
            status: {
              in: [
                AR_INVOICE_STATUSES.OPEN,
                AR_INVOICE_STATUSES.PARTIALLY_PAID,
                AR_INVOICE_STATUSES.DISPUTED,
              ],
            },
          },
        }),
        prisma.org_invoice_mst.count({
          where: { tenant_org_id: tenantId, status: AR_INVOICE_STATUSES.PAID },
        }),
        prisma.org_invoice_mst.count({
          where: { tenant_org_id: tenantId, status: AR_INVOICE_STATUSES.OVERDUE },
        }),
        prisma.org_invoice_mst.aggregate({
          where: {
            tenant_org_id: tenantId,
            status: {
              in: [
                AR_INVOICE_STATUSES.OPEN,
                AR_INVOICE_STATUSES.PARTIALLY_PAID,
                AR_INVOICE_STATUSES.OVERDUE,
                AR_INVOICE_STATUSES.DISPUTED,
              ],
            },
          },
          _sum: { outstanding_amount: true },
        }),
      ]);

    return {
      total_invoices,
      draft_invoices,
      open_invoices,
      paid_invoices,
      overdue_invoices,
      total_outstanding_amount: toNumber(outstanding._sum.outstanding_amount),
    };
  });
}

export async function exportArInvoicesCsv(
  query: Omit<ArInvoiceListQuery, 'page' | 'limit'> & { limit?: number },
  actor: ArActorContext = {}
): Promise<string> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const result = await listArInvoices(
    {
      ...query,
      page: 1,
      limit: Math.min(query.limit ?? 5000, 5000),
    },
    { tenantId }
  );

  const headers = [
    'Invoice No',
    'Invoice Date',
    'Customer',
    'Order No',
    'Type',
    'Status',
    'Currency',
    'Subtotal',
    'Discount',
    'Tax',
    'Total',
    'Paid Amount',
    'Outstanding Amount',
    'Due Date',
    'Payment Terms',
    'Issued At',
  ];

  const rows = result.data.map((invoice) =>
    [
      invoice.invoice_no,
      invoice.invoice_date,
      invoice.customer_name ?? invoice.customer_name2 ?? '',
      invoice.order_no ?? '',
      invoice.invoice_type_cd ?? '',
      invoice.status,
      invoice.currency_code,
      invoice.subtotal.toFixed(4),
      invoice.discount.toFixed(4),
      invoice.tax.toFixed(4),
      invoice.total.toFixed(4),
      invoice.paid_amount.toFixed(4),
      invoice.outstanding_amount.toFixed(4),
      invoice.due_date ?? '',
      invoice.payment_terms ?? '',
      invoice.issued_at ?? '',
    ].map(escapeCsvCell).join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export async function getArInvoiceDetail(invoiceId: string, actor: ArActorContext = {}): Promise<ArInvoiceDetail> {
  const tenantId = await resolveTenantId(actor.tenantId);

  return withTenantContext(tenantId, async () => {
    return getArInvoiceDetailWithReader(prisma, invoiceId, tenantId);
  });
}

async function getArInvoiceDetailWithReader(
  reader: ArInvoiceReader,
  invoiceId: string,
  tenantId: string
): Promise<ArInvoiceDetail> {
  const invoice = await reader.org_invoice_mst.findUnique({
    where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
    include: {
      org_customers_mst: { select: { name: true, name2: true } },
      org_orders_mst: { select: { order_no: true } },
      org_invoice_lines_dtl: { orderBy: { line_no: 'asc' } },
      org_invoice_orders_dtl: { orderBy: { created_at: 'asc' } },
      org_invoice_payments_dtl: { orderBy: { allocation_no: 'asc' } },
      org_invoice_adjustments_dtl: { orderBy: { adjustment_no: 'asc' } },
      org_invoice_status_history_dtl: { orderBy: { created_at: 'asc' } },
      org_customer_ar_ledger_dtl: { orderBy: [{ event_at: 'asc' }, { entry_no: 'asc' }] },
    },
  });

  if (!invoice) {
    throw new Error('AR invoice not found');
  }

  return {
    invoice: mapInvoiceHeader(invoice),
    lines: invoice.org_invoice_lines_dtl.map(mapInvoiceLine),
    orders: invoice.org_invoice_orders_dtl.map(mapOrderLink),
    allocations: invoice.org_invoice_payments_dtl.map(mapAllocation),
    adjustments: invoice.org_invoice_adjustments_dtl.map(mapAdjustment),
    history: invoice.org_invoice_status_history_dtl.map(mapHistory),
    ledger: invoice.org_customer_ar_ledger_dtl.map(mapLedger),
  };
}

export async function createArInvoice(input: CreateArInvoiceInput, actor: ArActorContext = {}) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      return withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_create',
        producer: async () => {
          const now = normalizeDateOnly(input.invoice_date) ?? new Date();
          const dueDate = normalizeDateOnly(input.due_date);
          const invoiceNo = await nextArInvoiceNumber(tenantId, tx);

          const created = await tx.org_invoice_mst.create({
            data: {
              tenant_org_id: tenantId,
              order_id: input.order_ids?.[0] ?? null,
              customer_id: input.customer_id,
              branch_id: input.branch_id ?? null,
              invoice_no: invoiceNo,
              invoice_date: now,
              due_date: dueDate ?? now,
              due_date_source_cd: dueDate
                ? AR_DUE_DATE_SOURCES.MANUAL_OVERRIDE
                : AR_DUE_DATE_SOURCES.INVOICE_DATE,
              payment_terms: input.payment_terms ?? null,
              payment_method_code: input.payment_method_code ?? null,
              currency_code: input.currency_code,
              currency_ex_rate: input.currency_ex_rate,
              subtotal: input.subtotal,
              discount: input.discount,
              tax: input.tax,
              total: input.total,
              paid_amount: 0,
              outstanding_amount: input.total,
              status: AR_INVOICE_STATUSES.DRAFT,
              invoice_type_cd: input.invoice_type_cd,
              numbering_doc_type_cd: AR_INVOICE_DOC_TYPES.AR_INV,
              metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
              rec_notes: input.rec_notes ?? null,
              approval_required: false,
              created_by: userId,
              updated_by: userId,
            },
          });

          if (input.lines.length > 0) {
            await tx.org_invoice_lines_dtl.createMany({
              data: input.lines.map((line, index) => ({
                tenant_org_id: tenantId,
                invoice_id: created.id,
                line_no: index + 1,
                line_type: line.line_type,
                source_type: line.source_type ?? null,
                source_order_id: line.source_order_id ?? null,
                source_order_item_id: line.source_order_item_id ?? null,
                description: line.description,
                description2: line.description2 ?? null,
                quantity: line.quantity,
                unit_price: line.unit_price,
                subtotal_amount: line.subtotal_amount ?? line.quantity * line.unit_price,
                discount_amount: line.discount_amount,
                taxable_amount: line.taxable_amount ?? (line.subtotal_amount ?? line.quantity * line.unit_price) - line.discount_amount,
                tax_rate: line.tax_rate ?? null,
                tax_amount: line.tax_amount,
                total_amount: line.total_amount ?? ((line.taxable_amount ?? (line.subtotal_amount ?? line.quantity * line.unit_price) - line.discount_amount) + line.tax_amount),
                currency_code: line.currency_code,
                currency_ex_rate: input.currency_ex_rate,
                metadata: (line.metadata ?? {}) as Prisma.InputJsonValue,
                created_by: userId,
                updated_by: userId,
              })),
            });
          }

          if (input.order_ids?.length) {
            const orders = await tx.org_orders_mst.findMany({
              where: {
                tenant_org_id: tenantId,
                id: { in: input.order_ids },
              },
              select: {
                id: true,
                total: true,
                paid_amount: true,
                outstanding_amount: true,
              },
            });

            await tx.org_invoice_orders_dtl.createMany({
              data: orders.map((order) => ({
                tenant_org_id: tenantId,
                invoice_id: created.id,
                order_id: order.id,
                order_total_amount: toNumber(order.total),
                invoiced_amount: toNumber(order.outstanding_amount ?? calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))),
                paid_before_amount: toNumber(order.paid_amount),
                credit_before_amount: 0,
                outstanding_amount: toNumber(order.outstanding_amount ?? calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))),
                allocation_policy: 'CUSTOM_AMOUNT',
                created_by: userId,
                updated_by: userId,
              })),
            });
          }

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId: created.id,
            toStatus: AR_INVOICE_STATUSES.DRAFT,
            actionCd: 'CREATE',
            metadata: { source: 'manual_ar_invoice' },
            userId,
          });

          const detail = await getArInvoiceDetailWithReader(tx, created.id, tenantId);
          return { resourceId: created.id, data: detail };
        },
      });
    })
  );
}

/**
 * Internal producer for `createArInvoiceFromOrders`. Always runs inside the
 * provided Prisma transaction client. Extracted so the public wrapper can
 * accept an optional caller-supplied `tx` (Phase 3 BVM Wiring — submit-order
 * threads its own tx through so the AR invoice commits atomically with the
 * order header and voucher).
 */
async function createArInvoiceFromOrdersInTx(
  tx: PrismaTx,
  input: CreateArInvoiceFromOrdersInput,
  tenantId: string,
  userId: string | null
) {
  return withIdempotency(tx, {
    tenantId,
    userId,
    key: input.idempotency_key ?? null,
    resourceType: 'ar_invoice_create_from_orders',
    producer: async () => {
      const orders = await tx.org_orders_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          id: { in: input.order_ids },
        },
        select: {
          id: true,
          order_no: true,
          customer_id: true,
          branch_id: true,
          total: true,
          paid_amount: true,
          outstanding_amount: true,
          currency_code: true,
          currency_ex_rate: true,
          payment_type_code: true,
          payment_due_date: true,
          payment_terms: true,
          b2b_contract_id: true,
          cost_center_code: true,
          po_number: true,
          // Phase 3 (BVM Wiring): pulled so the AR invoice header mirrors the
          // legacy `createInvoice` behavior of stamping the gift-card columns
          // for reporting parity (RPT-AR-001 reads them).
          gift_card_id: true,
        },
      });

      if (!orders.length) {
        throw new Error('No eligible orders found for AR invoice creation.');
      }

      const payOnCollectionOrder = orders.find(
        (order) => order.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION
      );
      if (payOnCollectionOrder) {
        throw new Error('PAY_ON_COLLECTION orders cannot generate an AR invoice.');
      }

      const customerIds = new Set(orders.map((order) => order.customer_id));
      if (customerIds.size > 1) {
        throw new Error('All orders on one AR invoice must belong to the same customer.');
      }

      const customerId = input.customer_id ?? orders[0]?.customer_id;
      if (!customerId) {
        throw new Error('Customer is required to create an AR invoice from orders.');
      }

      const currencyCode =
        input.currency_code ??
        orders.find((order) => order.currency_code)?.currency_code ??
        ORDER_DEFAULTS.CURRENCY;
      const branchId = orders[0]?.branch_id ?? null;
      // Phase 3 Round 2: receivable-only invoice sizing.
      //
      // Why: at submit-order tx1 time the source order has no payments yet
      // applied (settle runs in tx3), so `order.outstanding_amount` equals
      // the full sale. Sizing the invoice to that value and then relying on
      // a downstream cash-allocation tx (the old TX4 path) violated the
      // `chk_payments_voucher_required` constraint and inflated the invoice
      // header until allocation completed.
      //
      // When `expected_total_amount` is provided, the AR invoice represents
      // the actual receivable after cash + every CREDIT_APPLICATION leg has
      // been recorded on the voucher. Submit-order passes
      // `plan.outstandingAmount` (= finalTotal − realPayment − creditApplied).
      // API-route callers omit it and keep the legacy full-sale semantics.
      const legacySubtotal = orders.reduce((sum, order) => {
        const outstanding = toNumber(
          order.outstanding_amount ??
          calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))
        );
        return sum + outstanding;
      }, 0);
      const subtotal =
        input.expected_total_amount != null ? input.expected_total_amount : legacySubtotal;
      const invoiceDate = normalizeDateOnly(input.invoice_date) ?? new Date();
      const dueDate = normalizeDateOnly(input.due_date) ?? orders[0]?.payment_due_date ?? invoiceDate;
      const invoiceNo = await nextArInvoiceNumber(tenantId, tx);

      // Phase 3: caller controls whether the invoice is born DRAFT (API route
      // default — separate ISSUE step) or OPEN-and-ledger-posted (submit-order
      // flow — atomic with order). When issuing immediately we still call
      // `deriveArInvoiceStatus` so an already-past due_date opens as OVERDUE.
      const issueImmediately = input.issueImmediately === true;
      const initialStatus = issueImmediately
        ? deriveArInvoiceStatus({
            currentStatus: AR_INVOICE_STATUSES.OPEN,
            totalAmount: subtotal,
            paidAmount: 0,
            dueDate,
          })
        : AR_INVOICE_STATUSES.DRAFT;

      const created = await tx.org_invoice_mst.create({
        data: {
          tenant_org_id: tenantId,
          order_id: orders[0]?.id ?? null,
          customer_id: customerId,
          branch_id: branchId,
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          due_date: dueDate,
          due_date_source_cd: input.due_date
            ? AR_DUE_DATE_SOURCES.MANUAL_OVERRIDE
            : orders[0]?.b2b_contract_id
              ? AR_DUE_DATE_SOURCES.B2B_CONTRACT
              : AR_DUE_DATE_SOURCES.INVOICE_DATE,
          payment_terms: orders[0]?.payment_terms ?? null,
          currency_code: currencyCode,
          currency_ex_rate: toNumber(orders[0]?.currency_ex_rate ?? 1),
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          paid_amount: 0,
          outstanding_amount: subtotal,
          status: initialStatus,
          invoice_type_cd: orders[0]?.b2b_contract_id ? AR_INVOICE_TYPES.B2B_ORDER : AR_INVOICE_TYPES.ORDER_CREDIT,
          numbering_doc_type_cd: AR_INVOICE_DOC_TYPES.AR_INV,
          b2b_contract_id: orders[0]?.b2b_contract_id ?? null,
          cost_center_code: orders[0]?.cost_center_code ?? null,
          po_number: orders[0]?.po_number ?? null,
          // Phase 3: parity with legacy `createInvoice` — mirror gift-card
          // columns so RPT-AR-001 and the invoice print preview don't lose
          // visibility on which orders applied a gift card.
          gift_card_id: orders[0]?.gift_card_id ?? null,
          gift_card_applied_amount: input.gift_card_applied_amount ?? null,
          issued_at: issueImmediately ? invoiceDate : null,
          issued_by: issueImmediately ? userId : null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          rec_notes: input.rec_notes ?? null,
          created_by: userId,
          updated_by: userId,
        },
      });

      // Phase 3: ERP-lite auto-post dispatch — preserves the parity contract
      // with the legacy `createInvoice` adapter so tenants with BLOCKING
      // policies still gate invoice creation on ERP-lite success.
      await assertBlockingInvoiceAutoPostSucceeded(
        await ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction(tx, {
          invoice_id: created.id,
          invoice_no: created.invoice_no ?? null,
          order_id: created.order_id ?? null,
          branch_id: created.branch_id ?? null,
          currency_code: created.currency_code ?? ORDER_DEFAULTS.CURRENCY,
          exchange_rate: created.currency_ex_rate != null ? Number(created.currency_ex_rate) : 1,
          invoice_date: invoiceDate.toISOString().slice(0, 10),
          subtotal: Number(created.subtotal ?? 0),
          discount_amount: Number(created.discount ?? 0),
          tax_amount: Number(created.tax ?? 0),
          vat_amount: Number(created.vat_amount ?? 0),
          total_amount: Number(created.total ?? 0),
          created_by: userId,
        })
      );

      // Phase 3 Round 2: keep per-order link + line summary consistent with the
      // header `subtotal`. When `expected_total_amount` was provided AND there is
      // exactly one source order (the submit-order flow), the order link's
      // `invoiced_amount`/`outstanding_amount` and the line summary mirror that
      // amount instead of `order.outstanding_amount` (which is the full sale at
      // tx1 time). For multi-order API-route callers we keep the legacy split.
      const useExpectedSingleOrder =
        input.expected_total_amount != null && orders.length === 1;

      await tx.org_invoice_orders_dtl.createMany({
        data: orders.map((order) => {
          const orderOutstanding = toNumber(
            order.outstanding_amount ??
            calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))
          );
          const invoiced = useExpectedSingleOrder ? subtotal : orderOutstanding;
          return {
            tenant_org_id: tenantId,
            invoice_id: created.id,
            order_id: order.id,
            order_total_amount: toNumber(order.total),
            invoiced_amount: invoiced,
            paid_before_amount: toNumber(order.paid_amount),
            credit_before_amount: 0,
            outstanding_amount: invoiced,
            allocation_policy: input.allocation_policy,
            created_by: userId,
            updated_by: userId,
          };
        }),
      });

      await tx.org_invoice_lines_dtl.createMany({
        data: orders.map((order, index) => {
          const orderOutstanding = toNumber(
            order.outstanding_amount ??
            calculateOutstandingAmount(toNumber(order.total), toNumber(order.paid_amount))
          );
          const lineAmount = useExpectedSingleOrder ? subtotal : orderOutstanding;
          return {
            tenant_org_id: tenantId,
            invoice_id: created.id,
            line_no: index + 1,
            line_type: 'ORDER_SUMMARY',
            source_type: 'ORDER',
            source_order_id: order.id,
            source_order_item_id: null,
            description: `Order ${order.order_no ?? order.id}`,
            description2: null,
            quantity: 1,
            unit_price: lineAmount,
            subtotal_amount: lineAmount,
            discount_amount: 0,
            taxable_amount: lineAmount,
            tax_rate: null,
            tax_amount: 0,
            total_amount: lineAmount,
            currency_code: currencyCode,
            currency_ex_rate: toNumber(orders[0]?.currency_ex_rate ?? 1),
            metadata: { order_no: order.order_no } as Prisma.InputJsonValue,
            created_by: userId,
            updated_by: userId,
          };
        }),
      });

      await recordStatusHistoryTx(tx, {
        tenantId,
        invoiceId: created.id,
        toStatus: initialStatus,
        actionCd: issueImmediately ? 'CREATE_FROM_ORDERS_ISSUED' : 'CREATE_FROM_ORDERS',
        metadata: { order_count: orders.length, issued_immediately: issueImmediately },
        userId,
      });

      // Phase 3: when issuing immediately, mirror the issueArInvoice tail —
      // AR ledger DEBIT INVOICE_ISSUED + AR_INVOICE_ISSUED outbox event — so
      // downstream consumers see the same shape as a DRAFT → ISSUE flow.
      if (issueImmediately) {
        await appendLedgerEntryTx(tx, {
          tenantId,
          customerId,
          invoiceId: created.id,
          currencyCode,
          amount: subtotal,
          entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
          movementCd: AR_LEDGER_MOVEMENTS.INVOICE_ISSUED,
          refDocNo: created.invoice_no,
          eventAt: invoiceDate,
          metadata: { issued_immediately: true, source_flow: 'submit_order' },
          userId,
        });

        await emitEventTx(
          tx,
          tenantId,
          OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
          'ar_invoice',
          created.id,
          {
            invoice_id: created.id,
            invoice_no: created.invoice_no,
            issued_at: invoiceDate.toISOString(),
            issued_immediately: true,
          }
        );
      }

      const detail = await getArInvoiceDetailWithReader(tx, created.id, tenantId);
      return { resourceId: created.id, data: detail };
    },
  });
}

/**
 * Create an AR invoice from one or more orders.
 *
 * Phase 3 (BVM Wiring): added optional `tx` parameter so submit-order can
 * thread its own transaction in for atomic order+voucher+AR-invoice commits.
 * When `input.issueImmediately === true`, the invoice is born OPEN with an
 * AR ledger debit + AR_INVOICE_ISSUED outbox event (no separate ISSUE call
 * needed). Default behavior (DRAFT) preserved for API route callers.
 *
 * @param input  validated `createArInvoiceFromOrdersSchema` payload
 * @param actor  tenant + user context (auth fallback when tenantId omitted)
 * @param tx     optional caller-supplied transaction client; when present the
 *               producer runs inside it and DOES NOT open its own
 *               `prisma.$transaction` — atomicity is the caller's responsibility
 * @returns the fully hydrated AR invoice detail (header + lines + ledger + history)
 *
 * @example
 * // API route (DRAFT, owns its own tx):
 * await createArInvoiceFromOrders({ order_ids: [...], ... });
 *
 * // submit-order (OPEN, joins the order tx):
 * await prisma.$transaction(async (tx) => {
 *   await createArInvoiceFromOrders(
 *     { order_ids: [orderId], issueImmediately: true, idempotency_key: `${orderId}_ar`, ... },
 *     { tenantId, userId },
 *     tx,
 *   );
 * });
 */
export async function createArInvoiceFromOrders(
  input: CreateArInvoiceFromOrdersInput,
  actor: ArActorContext = {},
  tx?: PrismaTx
) {
  // Tenant resolved server-side from authenticated session when actor omits it.
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  if (tx) {
    return createArInvoiceFromOrdersInTx(tx, input, tenantId, userId);
  }

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (innerTx) =>
      createArInvoiceFromOrdersInTx(innerTx, input, tenantId, userId)
    )
  );
}

export async function updateArInvoice(
  invoiceId: string,
  input: UpdateArInvoiceInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () => {
    await prisma.$transaction(async (tx) => {
      const current = await tx.org_invoice_mst.findUnique({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
      });
      if (!current) throw new Error('AR invoice not found');

      const updated = await tx.org_invoice_mst.update({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
        data: {
          due_date: input.due_date ? normalizeDateOnly(input.due_date) : undefined,
          payment_terms: input.payment_terms,
          payment_method_code: input.payment_method_code,
          rec_notes: input.rec_notes,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await recordStatusHistoryTx(tx, {
        tenantId,
        invoiceId,
        fromStatus: current.status,
        toStatus: updated.status ?? AR_INVOICE_STATUSES.DRAFT,
        actionCd: 'UPDATE',
        metadata: { fields: Object.keys(input) },
        userId,
      });
    });

    return getArInvoiceDetail(invoiceId, { tenantId });
  });
}

export async function issueArInvoice(
  invoiceId: string,
  input: IssueArInvoiceInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) =>
      withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_issue',
        producer: async () => {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          });
          if (!invoice) throw new Error('AR invoice not found');
          if (normalizeArInvoiceStatus(invoice.status) !== AR_INVOICE_STATUSES.DRAFT) {
            throw new Error('Only DRAFT invoices can be issued.');
          }
          if (invoice.approval_required && !invoice.approved_at) {
            throw new Error('This invoice requires approval before issue.');
          }

          const issuedAt = normalizeDateOnly(input.issue_date) ?? new Date();
          const status = deriveArInvoiceStatus({
            currentStatus: AR_INVOICE_STATUSES.OPEN,
            totalAmount: toNumber(invoice.total),
            paidAmount: toNumber(invoice.paid_amount),
            dueDate: invoice.due_date,
          });

          await tx.org_invoice_mst.update({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            data: {
              status,
              issued_at: issuedAt,
              issued_by: input.issued_by ?? userId,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId,
            fromStatus: invoice.status,
            toStatus: status,
            actionCd: 'ISSUE',
            reason: input.notes ?? null,
            userId,
          });

          if (invoice.customer_id) {
            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: toNumber(invoice.total),
              entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
              movementCd: AR_LEDGER_MOVEMENTS.INVOICE_ISSUED,
              refDocNo: invoice.invoice_no,
              metadata: { issued_at: issuedAt.toISOString() },
              userId,
            });
          }

          await emitEventTx(
            tx,
            tenantId,
            OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED,
            'ar_invoice',
            invoiceId,
            {
              invoice_id: invoiceId,
              invoice_no: invoice.invoice_no,
              issued_at: issuedAt.toISOString(),
            }
          );

          const detail = await getArInvoiceDetail(invoiceId, { tenantId });
          return { resourceId: invoiceId, data: detail };
        },
      })
    )
  );
}

export async function approveSensitiveArInvoice(
  invoiceId: string,
  input: ApproveSensitiveArInvoiceInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) =>
      withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_approve_sensitive',
        producer: async () => {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          });
          if (!invoice) throw new Error('AR invoice not found');

          const pendingAdjustment = await tx.org_invoice_adjustments_dtl.findFirst({
            where: {
              tenant_org_id: tenantId,
              invoice_id: invoiceId,
              status_cd: AR_ADJUSTMENT_STATUSES.PENDING_APPROVAL,
              approval_action_cd: input.approval_action_cd,
            },
            orderBy: [{ created_at: 'desc' }, { adjustment_no: 'desc' }],
          });

          if (pendingAdjustment && !invoice.customer_id) {
            throw new Error('Invoice has no customer for AR adjustment approval.');
          }

          let approvedStatus = invoice.status ?? AR_INVOICE_STATUSES.DRAFT;
          let postedAdjustmentId: string | null = null;

          if (pendingAdjustment && invoice.customer_id) {
            const currentOutstanding = toNumber(
              invoice.outstanding_amount ??
              calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
            );
            const direction =
              pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT ||
              pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.WRITE_OFF
                ? AR_LEDGER_ENTRY_SIDES.CREDIT
                : AR_LEDGER_ENTRY_SIDES.DEBIT;
            const adjustmentAmount = toNumber(pendingAdjustment.adjustment_amount);
            const newOutstanding =
              direction === AR_LEDGER_ENTRY_SIDES.CREDIT
                ? Math.max(0, currentOutstanding - adjustmentAmount)
                : currentOutstanding + adjustmentAmount;

            approvedStatus =
              pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.WRITE_OFF && newOutstanding <= 0
                ? AR_INVOICE_STATUSES.WRITTEN_OFF
                : deriveArInvoiceStatus({
                    currentStatus: invoice.status,
                    totalAmount: toNumber(invoice.total),
                    paidAmount: Math.max(0, toNumber(invoice.total) - newOutstanding),
                    dueDate: invoice.due_date,
                  });

            await tx.org_invoice_adjustments_dtl.update({
              where: {
                id_tenant_org_id: {
                  id: pendingAdjustment.id,
                  tenant_org_id: tenantId,
                },
              },
              data: {
                status_cd: AR_ADJUSTMENT_STATUSES.POSTED,
                approved_at: new Date(),
                approved_by: userId,
                approval_action_cd: input.approval_action_cd,
                updated_at: new Date(),
                updated_by: userId,
              },
            });

            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              adjustmentId: pendingAdjustment.id,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: adjustmentAmount,
              entrySide: direction,
              movementCd:
                pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.WRITE_OFF
                  ? AR_LEDGER_MOVEMENTS.WRITE_OFF
                  : pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT
                    ? AR_LEDGER_MOVEMENTS.CREDIT_MEMO
                    : AR_LEDGER_MOVEMENTS.DEBIT_NOTE,
              refDocNo: invoice.invoice_no,
              metadata: { reason: pendingAdjustment.reason, approved_by: userId },
              userId,
            });

            postedAdjustmentId = pendingAdjustment.id;
          }

          await tx.org_invoice_mst.update({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            data: {
              approval_required: true,
              approval_action_cd: input.approval_action_cd,
              approval_notes: input.approval_notes ?? null,
              approved_at: new Date(),
              approved_by: userId,
              outstanding_amount:
                postedAdjustmentId != null
                  ? (() => {
                      const adjustment = pendingAdjustment!;
                      const currentOutstanding = toNumber(
                        invoice.outstanding_amount ??
                        calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
                      );
                      const adjustmentAmount = toNumber(adjustment.adjustment_amount);
                      return adjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT ||
                        adjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.WRITE_OFF
                        ? Math.max(0, currentOutstanding - adjustmentAmount)
                        : currentOutstanding + adjustmentAmount;
                    })()
                  : undefined,
              status: postedAdjustmentId != null ? approvedStatus : undefined,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId,
            fromStatus: invoice.status,
            toStatus: approvedStatus,
            actionCd: input.approval_action_cd,
            reason: input.approval_notes ?? null,
            metadata: postedAdjustmentId ? { adjustment_id: postedAdjustmentId } : undefined,
            userId,
          });

          if (pendingAdjustment && postedAdjustmentId) {
            const approvedEventType =
              pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.WRITE_OFF
                ? OUTBOX_EVENT_TYPES.AR_WRITE_OFF_POSTED
                : pendingAdjustment.adjustment_type_cd === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT
                  ? OUTBOX_EVENT_TYPES.AR_CREDIT_MEMO_POSTED
                  : OUTBOX_EVENT_TYPES.AR_DEBIT_NOTE_POSTED;

            await emitEventTx(tx, tenantId, approvedEventType, 'ar_invoice', invoiceId, {
              invoice_id: invoiceId,
              invoice_no: invoice.invoice_no,
              adjustment_id: postedAdjustmentId,
              approval_action_cd: input.approval_action_cd,
            });
          }

          const detail = await getArInvoiceDetail(invoiceId, { tenantId });
          return { resourceId: invoiceId, data: detail };
        },
      })
    )
  );
}

export async function voidArInvoice(
  invoiceId: string,
  input: VoidArInvoiceInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) =>
      withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_void',
        producer: async () => {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          });
          if (!invoice) throw new Error('AR invoice not found');
          if (invoice.approved_at == null || invoice.approval_action_cd !== AR_SENSITIVE_APPROVAL_ACTIONS.APPROVE_VOID) {
            throw new Error('Void approval is required before voiding an AR invoice.');
          }

          const priorOutstanding = toNumber(invoice.outstanding_amount ?? calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount)));

          await tx.org_invoice_mst.update({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            data: {
              status: AR_INVOICE_STATUSES.VOID,
              outstanding_amount: 0,
              voided_at: new Date(),
              voided_by: userId,
              void_reason: input.reason,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId,
            fromStatus: invoice.status,
            toStatus: AR_INVOICE_STATUSES.VOID,
            actionCd: 'VOID',
            reason: input.reason,
            userId,
          });

          if (invoice.customer_id && priorOutstanding > 0) {
            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: priorOutstanding,
              entrySide: AR_LEDGER_ENTRY_SIDES.CREDIT,
              movementCd: AR_LEDGER_MOVEMENTS.VOID,
              refDocNo: invoice.invoice_no,
              metadata: { reason: input.reason },
              userId,
            });
          }

          await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.AR_INVOICE_VOIDED, 'ar_invoice', invoiceId, {
            invoice_id: invoiceId,
            invoice_no: invoice.invoice_no,
            void_reason: input.reason,
          });

          const detail = await getArInvoiceDetail(invoiceId, { tenantId });
          return { resourceId: invoiceId, data: detail };
        },
      })
    )
  );
}

export async function allocateArPayment(
  invoiceId: string,
  input: AllocateArPaymentInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) =>
      withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_allocate_payment',
        producer: async () => {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          });
          if (!invoice) throw new Error('AR invoice not found');
          if (!invoice.customer_id) throw new Error('Invoice has no customer for AR allocation.');

          const currentOutstanding = toNumber(
            invoice.outstanding_amount ??
            calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
          );
          const appliedToInvoice = Math.min(currentOutstanding, input.allocated_amount);
          const unappliedCreditAmount = Math.max(0, input.allocated_amount - appliedToInvoice);
          const updatedPaidAmount = toNumber(invoice.paid_amount) + appliedToInvoice;
          const allocationNo = await nextScopedSequence(tx, 'org_invoice_payments_dtl', tenantId, {
            invoiceId,
          });
          const allocationOutcome =
            unappliedCreditAmount > 0
              ? AR_ALLOCATION_OUTCOMES.UNAPPLIED_CREDIT
              : appliedToInvoice < currentOutstanding
                ? AR_ALLOCATION_OUTCOMES.PARTIAL
                : AR_ALLOCATION_OUTCOMES.APPLIED;

          const allocation = await tx.org_invoice_payments_dtl.create({
            data: {
              tenant_org_id: tenantId,
              invoice_id: invoiceId,
              payment_id: input.payment_id ?? null,
              voucher_id: input.voucher_id ?? null,
              allocation_no: allocationNo,
              allocation_outcome: allocationOutcome,
              allocated_amount: appliedToInvoice,
              unapplied_credit_amount: unappliedCreditAmount,
              applied_at: normalizeDateOnly(input.applied_at) ?? new Date(),
              metadata: { notes: input.notes } as Prisma.InputJsonValue,
              created_by: userId,
              updated_by: userId,
            },
          });

          const newStatus = deriveArInvoiceStatus({
            currentStatus: invoice.status,
            totalAmount: toNumber(invoice.total),
            paidAmount: updatedPaidAmount,
            dueDate: invoice.due_date,
          });

          await tx.org_invoice_mst.update({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            data: {
              paid_amount: updatedPaidAmount,
              outstanding_amount: calculateOutstandingAmount(toNumber(invoice.total), updatedPaidAmount),
              status: newStatus,
              paid_at: newStatus === AR_INVOICE_STATUSES.PAID ? new Date() : undefined,
              paid_by: userId,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId,
            fromStatus: invoice.status,
            toStatus: newStatus,
            actionCd: 'ALLOCATE_PAYMENT',
            reason: input.notes ?? null,
            userId,
          });

          await appendLedgerEntryTx(tx, {
            tenantId,
            customerId: invoice.customer_id,
            invoiceId,
            paymentAllocId: allocation.id,
            voucherId: input.voucher_id ?? null,
            currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
            amount: appliedToInvoice,
            entrySide: AR_LEDGER_ENTRY_SIDES.CREDIT,
            movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_APPLIED,
            refDocNo: invoice.invoice_no,
            metadata: { payment_id: input.payment_id, notes: input.notes },
            userId,
          });

          if (unappliedCreditAmount > 0) {
            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              paymentAllocId: allocation.id,
              voucherId: input.voucher_id ?? null,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: unappliedCreditAmount,
              entrySide: AR_LEDGER_ENTRY_SIDES.CREDIT,
              movementCd: AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT,
              refDocNo: invoice.invoice_no,
              metadata: { payment_id: input.payment_id, notes: input.notes },
              userId,
            });
          }

          await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.AR_PAYMENT_ALLOCATED, 'ar_invoice', invoiceId, {
            invoice_id: invoiceId,
            invoice_no: invoice.invoice_no,
            payment_id: input.payment_id ?? null,
            voucher_id: input.voucher_id ?? null,
            allocated_amount: appliedToInvoice,
            unapplied_credit_amount: unappliedCreditAmount,
          });

          if (unappliedCreditAmount > 0) {
            await emitEventTx(
              tx,
              tenantId,
              OUTBOX_EVENT_TYPES.AR_OVERPAYMENT_CREDIT_CREATED,
              'ar_invoice',
              invoiceId,
              {
                invoice_id: invoiceId,
                invoice_no: invoice.invoice_no,
                payment_id: input.payment_id ?? null,
                voucher_id: input.voucher_id ?? null,
                unapplied_credit_amount: unappliedCreditAmount,
              }
            );
          }

          const detail = await getArInvoiceDetail(invoiceId, { tenantId });
          return { resourceId: allocation.id, data: detail };
        },
      })
    )
  );
}

export async function reverseArPaymentAllocation(
  invoiceId: string,
  allocationId: string,
  input: ReverseArPaymentAllocationInput,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) =>
      withIdempotency(tx, {
        tenantId,
        userId,
        key: input.idempotency_key ?? null,
        resourceType: 'ar_invoice_reverse_payment_allocation',
        producer: async () => {
          const [invoice, allocation] = await Promise.all([
            tx.org_invoice_mst.findUnique({
              where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            }),
            tx.org_invoice_payments_dtl.findFirst({
              where: {
                tenant_org_id: tenantId,
                id: allocationId,
                invoice_id: invoiceId,
              },
            }),
          ]);

          if (!invoice) throw new Error('AR invoice not found');
          if (!invoice.customer_id) throw new Error('Invoice has no customer for AR allocation reversal.');
          if (!allocation) throw new Error('AR payment allocation not found');
          if (allocation.reversed_at) throw new Error('This AR payment allocation has already been reversed.');

          const reversedAt = normalizeDateOnly(input.reversed_at) ?? new Date();
          const reversedAppliedAmount = toNumber(allocation.allocated_amount);
          const reversedCreditAmount = toNumber(allocation.unapplied_credit_amount);
          const updatedPaidAmount = Math.max(0, toNumber(invoice.paid_amount) - reversedAppliedAmount);
          const updatedOutstandingAmount = calculateOutstandingAmount(
            toNumber(invoice.total),
            updatedPaidAmount
          );
          const newStatus = deriveArInvoiceStatus({
            currentStatus: invoice.status,
            totalAmount: toNumber(invoice.total),
            paidAmount: updatedPaidAmount,
            dueDate: invoice.due_date,
          });

          await tx.org_invoice_payments_dtl.update({
            where: {
              id_tenant_org_id: {
                id: allocationId,
                tenant_org_id: tenantId,
              },
            },
            data: {
              allocation_outcome: AR_ALLOCATION_OUTCOMES.REVERSED,
              reversed_at: reversedAt,
              reversed_by: userId,
              reversal_reason: input.reason,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await tx.org_invoice_mst.update({
            where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
            data: {
              paid_amount: updatedPaidAmount,
              outstanding_amount: updatedOutstandingAmount,
              status: newStatus,
              paid_at: newStatus === AR_INVOICE_STATUSES.PAID ? invoice.paid_at : null,
              paid_by: newStatus === AR_INVOICE_STATUSES.PAID ? invoice.paid_by : null,
              updated_at: new Date(),
              updated_by: userId,
            },
          });

          await recordStatusHistoryTx(tx, {
            tenantId,
            invoiceId,
            fromStatus: invoice.status,
            toStatus: newStatus,
            actionCd: 'REVERSE_PAYMENT_ALLOCATION',
            reason: input.reason,
            metadata: {
              allocation_id: allocationId,
              reversed_at: reversedAt.toISOString(),
            },
            userId,
          });

          if (reversedAppliedAmount > 0) {
            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              paymentAllocId: allocationId,
              voucherId: allocation.voucher_id ?? null,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: reversedAppliedAmount,
              entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
              movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_REVERSED,
              refDocNo: invoice.invoice_no,
              metadata: {
                payment_id: allocation.payment_id,
                reversal_reason: input.reason,
              },
              userId,
            });
          }

          if (reversedCreditAmount > 0) {
            await appendLedgerEntryTx(tx, {
              tenantId,
              customerId: invoice.customer_id,
              invoiceId,
              paymentAllocId: allocationId,
              voucherId: allocation.voucher_id ?? null,
              currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
              amount: reversedCreditAmount,
              entrySide: AR_LEDGER_ENTRY_SIDES.DEBIT,
              movementCd: AR_LEDGER_MOVEMENTS.PAYMENT_REVERSED,
              refDocNo: invoice.invoice_no,
              metadata: {
                payment_id: allocation.payment_id,
                reversal_reason: input.reason,
                reversal_kind: 'UNAPPLIED_CREDIT',
              },
              userId,
            });
          }

          await emitEventTx(
            tx,
            tenantId,
            OUTBOX_EVENT_TYPES.AR_PAYMENT_ALLOCATION_REVERSED,
            'ar_invoice',
            invoiceId,
            {
              invoice_id: invoiceId,
              invoice_no: invoice.invoice_no,
              allocation_id: allocationId,
              payment_id: allocation.payment_id,
              voucher_id: allocation.voucher_id,
              reversed_allocated_amount: reversedAppliedAmount,
              reversed_unapplied_credit_amount: reversedCreditAmount,
            }
          );

          const detail = await getArInvoiceDetail(invoiceId, { tenantId });
          return { resourceId: allocationId, data: detail };
        },
      })
    )
  );
}

async function createArAdjustment(
  invoiceId: string,
  input: { amount: number; reason: string; typeCode: string; approvalRequired: boolean },
  actor: ArActorContext
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const invoice = await tx.org_invoice_mst.findUnique({
        where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
      });
      if (!invoice) throw new Error('AR invoice not found');
      if (!invoice.customer_id) throw new Error('Invoice has no customer for AR adjustments.');

      const adjustmentNo = await nextScopedSequence(tx, 'org_invoice_adjustments_dtl', tenantId, {
        invoiceId,
      });
      const statusCd = input.approvalRequired
        ? AR_ADJUSTMENT_STATUSES.PENDING_APPROVAL
        : AR_ADJUSTMENT_STATUSES.POSTED;
      const approvalActionCd = getApprovalActionForAdjustment(input.typeCode);
      const adjustment = await tx.org_invoice_adjustments_dtl.create({
        data: {
          tenant_org_id: tenantId,
          invoice_id: invoiceId,
          adjustment_no: adjustmentNo,
          adjustment_type_cd: input.typeCode,
          adjustment_amount: input.amount,
          status_cd: statusCd,
          approval_action_cd: approvalActionCd,
          reason: input.reason,
          created_by: userId,
          updated_by: userId,
        },
      });

      if (input.approvalRequired) {
        await tx.org_invoice_mst.update({
          where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          data: {
            approval_required: true,
            approval_action_cd: approvalActionCd,
            approved_at: null,
            approved_by: null,
            approval_notes: null,
            updated_at: new Date(),
            updated_by: userId,
          },
        });
      } else {
        const direction =
          input.typeCode === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT ||
          input.typeCode === AR_ADJUSTMENT_TYPES.WRITE_OFF
            ? AR_LEDGER_ENTRY_SIDES.CREDIT
            : AR_LEDGER_ENTRY_SIDES.DEBIT;
        const currentOutstanding = toNumber(
          invoice.outstanding_amount ??
          calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
        );
        const newOutstanding =
          direction === AR_LEDGER_ENTRY_SIDES.CREDIT
            ? Math.max(0, currentOutstanding - input.amount)
            : currentOutstanding + input.amount;
        const newStatus =
          input.typeCode === AR_ADJUSTMENT_TYPES.WRITE_OFF && newOutstanding <= 0
            ? AR_INVOICE_STATUSES.WRITTEN_OFF
            : deriveArInvoiceStatus({
                currentStatus: invoice.status,
                totalAmount: toNumber(invoice.total),
                paidAmount: toNumber(invoice.total) - newOutstanding,
                dueDate: invoice.due_date,
              });

        await tx.org_invoice_mst.update({
          where: { id_tenant_org_id: { id: invoiceId, tenant_org_id: tenantId } },
          data: {
            outstanding_amount: newOutstanding,
            status: newStatus,
            updated_at: new Date(),
            updated_by: userId,
          },
        });

        await appendLedgerEntryTx(tx, {
          tenantId,
          customerId: invoice.customer_id,
          invoiceId,
          adjustmentId: adjustment.id,
          currencyCode: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
          amount: input.amount,
          entrySide: direction,
          movementCd:
            input.typeCode === AR_ADJUSTMENT_TYPES.WRITE_OFF
              ? AR_LEDGER_MOVEMENTS.WRITE_OFF
              : input.typeCode === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT
                ? AR_LEDGER_MOVEMENTS.CREDIT_MEMO
                : AR_LEDGER_MOVEMENTS.DEBIT_NOTE,
          refDocNo: invoice.invoice_no,
          metadata: { reason: input.reason },
          userId,
        });

        await recordStatusHistoryTx(tx, {
          tenantId,
          invoiceId,
          fromStatus: invoice.status,
          toStatus: newStatus,
          actionCd: input.typeCode,
          reason: input.reason,
            userId,
          });

        const eventType =
          input.typeCode === AR_ADJUSTMENT_TYPES.WRITE_OFF
            ? OUTBOX_EVENT_TYPES.AR_WRITE_OFF_POSTED
            : input.typeCode === AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT
              ? OUTBOX_EVENT_TYPES.AR_CREDIT_MEMO_POSTED
              : OUTBOX_EVENT_TYPES.AR_DEBIT_NOTE_POSTED;

        await emitEventTx(tx, tenantId, eventType, 'ar_invoice', invoiceId, {
          invoice_id: invoiceId,
          invoice_no: invoice.invoice_no,
          adjustment_id: adjustment.id,
          adjustment_type_cd: input.typeCode,
          adjustment_amount: input.amount,
        });
      }

      return getArInvoiceDetail(invoiceId, { tenantId });
    })
  );
}

export async function createArCreditNote(
  invoiceId: string,
  input: CreateCreditNoteInput,
  actor: ArActorContext = {}
) {
  return createArAdjustment(
    invoiceId,
    {
      amount: input.adjustment_amount,
      reason: input.reason,
      typeCode: AR_ADJUSTMENT_TYPES.CREDIT_ADJUSTMENT,
      approvalRequired: input.approval_required,
    },
    actor
  );
}

export async function createArDebitNote(
  invoiceId: string,
  input: CreateDebitNoteInput,
  actor: ArActorContext = {}
) {
  return createArAdjustment(
    invoiceId,
    {
      amount: input.adjustment_amount,
      reason: input.reason,
      typeCode: AR_ADJUSTMENT_TYPES.DEBIT_ADJUSTMENT,
      approvalRequired: input.approval_required,
    },
    actor
  );
}

export async function writeOffArInvoice(
  invoiceId: string,
  input: WriteOffArInvoiceInput,
  actor: ArActorContext = {}
) {
  const invoice = await getArInvoiceDetail(invoiceId, actor);
  const amount = input.adjustment_amount ?? invoice.invoice.outstanding_amount;
  return createArAdjustment(
    invoiceId,
    {
      amount,
      reason: input.reason,
      typeCode: AR_ADJUSTMENT_TYPES.WRITE_OFF,
      approvalRequired: input.approval_required,
    },
    actor
  );
}

export async function getArCustomerBalance(customerId: string, actor: ArActorContext = {}): Promise<ArCustomerBalance> {
  const tenantId = await resolveTenantId(actor.tenantId);

  return withTenantContext(tenantId, async () => {
    const [invoices, ledger] = await Promise.all([
      prisma.org_invoice_mst.findMany({
        where: { tenant_org_id: tenantId, customer_id: customerId },
        select: {
          total: true,
          paid_amount: true,
          outstanding_amount: true,
          currency_code: true,
          status: true,
          updated_at: true,
          created_at: true,
        },
      }),
      prisma.org_customer_ar_ledger_dtl.findMany({
        where: { tenant_org_id: tenantId, customer_id: customerId },
        select: {
          amount: true,
          movement_cd: true,
          entry_side: true,
          currency_code: true,
          event_at: true,
        },
      }),
    ]);

    const totalInvoiced = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
    const totalPaid = invoices.reduce((sum, invoice) => sum + toNumber(invoice.paid_amount), 0);
    const totalOutstanding = invoices.reduce((sum, invoice) => {
      const normalized = normalizeArInvoiceStatus(invoice.status);
      if (!isArInvoiceOpenBalanceStatus(normalized)) {
        return sum;
      }
      return sum + toNumber(invoice.outstanding_amount ?? calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount)));
    }, 0);
    const unappliedCreditAmount = ledger.reduce((sum, entry) => {
      return entry.movement_cd === AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT ? sum + toNumber(entry.amount) : sum;
    }, 0);
    const lastActivity = ledger.reduce<Date | null>((latest, entry) => {
      if (!latest || entry.event_at > latest) return entry.event_at;
      return latest;
    }, null);

    return {
      customer_id: customerId,
      currency_code: invoices[0]?.currency_code ?? ledger[0]?.currency_code ?? ORDER_DEFAULTS.CURRENCY,
      open_invoice_count: invoices.filter((invoice) => {
        const normalized = normalizeArInvoiceStatus(invoice.status);
        return isArInvoiceOpenBalanceStatus(normalized) && toNumber(invoice.outstanding_amount ?? 0) > 0;
      }).length,
      total_invoiced_amount: totalInvoiced,
      total_paid_amount: totalPaid,
      total_outstanding_amount: totalOutstanding,
      unapplied_credit_amount: unappliedCreditAmount,
      net_balance_amount: Math.max(0, totalOutstanding - unappliedCreditAmount),
      last_activity_at: lastActivity?.toISOString(),
    };
  });
}

export async function listArCustomerBalances(
  input: {
    page: number;
    limit: number;
    search?: string;
  },
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const offset = (input.page - 1) * input.limit;

  return withTenantContext(tenantId, async () => {
    const where: Prisma.org_customers_mstWhereInput = {
      tenant_org_id: tenantId,
      OR: [
        { org_invoice_mst: { some: { tenant_org_id: tenantId } } },
        { org_customer_ar_ledger_dtl: { some: { tenant_org_id: tenantId } } },
      ],
    };

    if (input.search?.trim()) {
      const search = input.search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { name2: { contains: search, mode: 'insensitive' } },
            { display_name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.org_customers_mst.findMany({
        where,
        select: {
          id: true,
          name: true,
          name2: true,
          org_invoice_mst: {
            select: {
              total: true,
              paid_amount: true,
              outstanding_amount: true,
              currency_code: true,
              status: true,
              updated_at: true,
              created_at: true,
            },
          },
          org_customer_ar_ledger_dtl: {
            select: {
              amount: true,
              movement_cd: true,
              entry_side: true,
              currency_code: true,
              event_at: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { created_at: 'asc' }],
        skip: offset,
        take: input.limit,
      }),
      prisma.org_customers_mst.count({ where }),
    ]);

    const data: ArCustomerBalanceRow[] = customers.map((customer) => {
      const invoices = customer.org_invoice_mst;
      const ledger = customer.org_customer_ar_ledger_dtl;
      const totalInvoiced = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
      const totalPaid = invoices.reduce((sum, invoice) => sum + toNumber(invoice.paid_amount), 0);
      const totalOutstanding = invoices.reduce((sum, invoice) => {
        const normalized = normalizeArInvoiceStatus(invoice.status);
        if (!isArInvoiceOpenBalanceStatus(normalized)) {
          return sum;
        }
        return sum + toNumber(
          invoice.outstanding_amount ??
            calculateOutstandingAmount(toNumber(invoice.total), toNumber(invoice.paid_amount))
        );
      }, 0);
      const unappliedCreditAmount = ledger.reduce((sum, entry) => {
        return entry.movement_cd === AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT ? sum + toNumber(entry.amount) : sum;
      }, 0);
      const lastActivity = ledger.reduce<Date | null>((latest, entry) => {
        if (!latest || entry.event_at > latest) return entry.event_at;
        return latest;
      }, null);

      return {
        customer_id: customer.id,
        customer_name: customer.name ?? undefined,
        customer_name2: customer.name2 ?? undefined,
        currency_code: invoices[0]?.currency_code ?? ledger[0]?.currency_code ?? ORDER_DEFAULTS.CURRENCY,
        open_invoice_count: invoices.filter((invoice) => {
          const normalized = normalizeArInvoiceStatus(invoice.status);
          return isArInvoiceOpenBalanceStatus(normalized) && toNumber(invoice.outstanding_amount ?? 0) > 0;
        }).length,
        total_invoiced_amount: totalInvoiced,
        total_paid_amount: totalPaid,
        total_outstanding_amount: totalOutstanding,
        unapplied_credit_amount: unappliedCreditAmount,
        net_balance_amount: Math.max(0, totalOutstanding - unappliedCreditAmount),
        last_activity_at: lastActivity?.toISOString(),
      };
    });

    return {
      data,
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    };
  });
}

export async function getArCustomerLedger(
  customerId: string,
  query: ArLedgerQuery,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  return withTenantContext(tenantId, async () => {
    const where: Prisma.org_customer_ar_ledger_dtlWhereInput = {
      tenant_org_id: tenantId,
      customer_id: customerId,
    };
    if (query.date_from || query.date_to) {
      where.event_at = {};
      if (query.date_from) where.event_at.gte = new Date(query.date_from);
      if (query.date_to) where.event_at.lte = new Date(query.date_to);
    }

    const [rows, total] = await Promise.all([
      prisma.org_customer_ar_ledger_dtl.findMany({
        where,
        orderBy: [{ event_at: 'desc' }, { entry_no: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.org_customer_ar_ledger_dtl.count({ where }),
    ]);

    return {
      data: rows.map(mapLedger),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getArCustomerStatement(
  customerId: string,
  query: ArStatementQuery,
  actor: ArActorContext = {}
): Promise<ArCustomerStatement> {
  const tenantId = await resolveTenantId(actor.tenantId);

  return withTenantContext(tenantId, async () => {
    const customer = await prisma.org_customers_mst.findFirst({
      where: { tenant_org_id: tenantId, id: customerId },
      select: { name: true, name2: true },
    });
    if (!customer) throw new Error('Customer not found');

    const where: Prisma.org_customer_ar_ledger_dtlWhereInput = {
      tenant_org_id: tenantId,
      customer_id: customerId,
    };
    const openingWhere: Prisma.org_customer_ar_ledger_dtlWhereInput = {
      tenant_org_id: tenantId,
      customer_id: customerId,
    };
    if (query.date_from || query.date_to) {
      where.event_at = {};
      if (query.date_from) where.event_at.gte = new Date(query.date_from);
      if (query.date_to) where.event_at.lte = new Date(query.date_to);
      if (query.date_from) {
        openingWhere.event_at = { lt: new Date(query.date_from) };
      }
    }

    const [ledgerRows, openingRow] = await Promise.all([
      prisma.org_customer_ar_ledger_dtl.findMany({
        where,
        orderBy: [{ event_at: 'asc' }, { entry_no: 'asc' }],
      }),
      query.date_from
        ? prisma.org_customer_ar_ledger_dtl.findFirst({
            where: openingWhere,
            orderBy: [{ event_at: 'desc' }, { entry_no: 'desc' }],
            select: { running_balance: true },
          })
        : Promise.resolve(null),
    ]);

    const openingBalance = toNumber(openingRow?.running_balance);
    const lines: ArStatementLine[] = ledgerRows.map((row) => ({
      kind: row.movement_cd === AR_LEDGER_MOVEMENTS.INVOICE_ISSUED ? 'INVOICE' : 'LEDGER',
      event_at: row.event_at.toISOString(),
      ref_no: row.ref_doc_no ?? undefined,
      description: row.movement_cd,
      debit_amount: row.entry_side === AR_LEDGER_ENTRY_SIDES.DEBIT ? toNumber(row.amount) : 0,
      credit_amount: row.entry_side === AR_LEDGER_ENTRY_SIDES.CREDIT ? toNumber(row.amount) : 0,
      running_balance: toNumber(row.running_balance),
      currency_code: row.currency_code,
      metadata: parseJsonRecord(row.metadata),
    }));
    const closingBalance = lines.at(-1)?.running_balance ?? openingBalance;

    return {
      customer_id: customerId,
      customer_name: customer.name ?? undefined,
      customer_name2: customer.name2 ?? undefined,
      currency_code: ledgerRows[0]?.currency_code ?? ORDER_DEFAULTS.CURRENCY,
      period_start: query.date_from,
      period_end: query.date_to,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      lines,
    };
  });
}

export async function getArAgingReport(
  query: ArAgingQuery,
  actor: ArActorContext = {}
) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const asOfDate = normalizeDateOnly(query.as_of_date) ?? new Date();
  const page = query.page;
  const limit = query.limit;

  return withTenantContext(tenantId, async () => {
    const where: Prisma.org_invoice_mstWhereInput = {
      tenant_org_id: tenantId,
      outstanding_amount: { gt: 0 },
      status: {
        in: [
          AR_INVOICE_STATUSES.OPEN,
          AR_INVOICE_STATUSES.PARTIALLY_PAID,
          AR_INVOICE_STATUSES.OVERDUE,
          AR_INVOICE_STATUSES.DISPUTED,
        ],
      },
    };
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.customer_id) where.customer_id = query.customer_id;
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { invoice_no: { contains: search, mode: 'insensitive' } },
        { org_customers_mst: { name: { contains: search, mode: 'insensitive' } } },
        { org_customers_mst: { name2: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const invoices = await prisma.org_invoice_mst.findMany({
      where,
      include: {
        org_customers_mst: { select: { id: true, name: true, name2: true } },
      },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });

    const grouped = new Map<string, ArAgingCustomerRow>();

    for (const invoice of invoices) {
      const customerId = invoice.customer_id ?? 'unknown';
      const row = grouped.get(customerId) ?? {
        customer_id: customerId,
        customer_name: invoice.org_customers_mst?.name ?? undefined,
        customer_name2: invoice.org_customers_mst?.name2 ?? undefined,
        currency_code: invoice.currency_code ?? ORDER_DEFAULTS.CURRENCY,
        current_amount: 0,
        due_1_30_amount: 0,
        due_31_60_amount: 0,
        due_61_90_amount: 0,
        due_90_plus_amount: 0,
        total_outstanding_amount: 0,
      };

      const dueDate = invoice.due_date ?? invoice.invoice_date ?? invoice.created_at;
      const daysPastDue = Math.max(
        0,
        Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      const outstanding = toNumber(invoice.outstanding_amount);

      if (daysPastDue <= 0) row.current_amount += outstanding;
      else if (daysPastDue <= 30) row.due_1_30_amount += outstanding;
      else if (daysPastDue <= 60) row.due_31_60_amount += outstanding;
      else if (daysPastDue <= 90) row.due_61_90_amount += outstanding;
      else row.due_90_plus_amount += outstanding;

      row.total_outstanding_amount += outstanding;
      grouped.set(customerId, row);
    }

    const rows = Array.from(grouped.values());
    const total = rows.length;
    const offset = (page - 1) * limit;
    const pagedRows = rows.slice(offset, offset + limit);

    return {
      data: pagedRows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      as_of_date: asOfDate.toISOString().slice(0, 10),
    };
  });
}
