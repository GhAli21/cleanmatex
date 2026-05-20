import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status';

/**
 * Why:
 * Order Fin now exposes one richer read model so checkout, order detail,
 * reports, and future mobile/API consumers all read the same financial truth
 * instead of stitching together partial views independently.
 */

export interface OrderFinancialSnapshot {
  orderId: string;
  orderNo: string | null;
  currencyCode: string | null;
  paymentTypeCode: string | null;
  paymentStatus: string;
  subtotalAmount: number;
  totalChargesAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  totalRefundedAmount: number;
  outstandingAmount: number;
  payOnCollectionAmount: number;
  giftCardAppliedAmount: number;
  changeReturnedAmount: number;
}

export interface OrderChargeRow {
  id: string;
  charge_type: string;
  label: string | null;
  label2: string | null;
  amount: number;
  currency_code: string | null;
}

export interface OrderTaxRow {
  id: string;
  tax_type: string;
  label: string;
  rate: number;
  tax_amount: number;
  currency_code: string;
}

export interface OrderPaymentRow {
  id: string;
  payment_method_code: string | null;
  payment_nature_snapshot: string | null;
  amount: number;
  payment_status: string | null;
  received_by: string | null;
  gateway_code: string | null;
  gateway_reference: string | null;
  branch_payment_method_id: string | null;
  created_at: string;
}

export interface OrderCreditApplicationRow {
  id: string;
  credit_type: string;
  credit_source_id: string | null;
  applied_amount: number;
  currency_code: string;
  reference_no: string | null;
  applied_by: string | null;
  applied_at: string;
}

export interface OrderRefundRow {
  id: string;
  refund_no: string | null;
  refund_amount: number;
  refund_status: string | null;
  refund_method_code: string | null;
  reason_code: string | null;
  currency_code: string | null;
  original_payment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrderAdjustmentRow {
  id: string;
  adjustment_type: string;
  amount: number;
  currency_code: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface OrderDiscountRow {
  id: string;
  source_type: string;
  source_name: string | null;
  discount_type: string;
  discount_rate: number | null;
  discount_amount: number;
}

export interface OrderFinancialTimelineRow {
  id: string;
  eventType: string;
  status: string | null;
  amount: number | null;
  happenedAt: string;
}

export interface OrderFinancialSummary {
  snapshot: OrderFinancialSnapshot;
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  voucherReferences: Array<{ voucherId: string; voucherLineId: string | null; source: 'PAYMENT' | 'REFUND' | 'CREDIT_APPLICATION' }>;
  auditTimeline: OrderFinancialTimelineRow[];
}

function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Read the full Order Fin summary for one order under tenant scope.
 *
 * @param tenantId authenticated tenant identifier
 * @param orderId order header identifier
 * @returns normalized read model used by routes and server actions
 */
export async function getOrderFinancialSummary(
  tenantId: string,
  orderId: string
): Promise<OrderFinancialSummary> {
  let adjustments: OrderAdjustmentRow[] = [];

  const [
    order,
    charges,
    taxes,
    payments,
    creditApplications,
    refunds,
    discountLines,
  ] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_orders_mst.findFirstOrThrow({
        where: { tenant_org_id: tenantId, id: orderId },
        select: {
          id: true,
          order_no: true,
          currency_code: true,
          payment_type_code: true,
          payment_status: true,
          subtotal: true,
          total: true,
          total_charges_amount: true,
          total_discount_amount: true,
          total_tax_amount: true,
          total_credit_applied_amount: true,
          total_paid_amount: true,
          outstanding_amount: true,
          pay_on_collection_amount: true,
          gift_card_applied_amount: true,
          change_returned_amount: true,
        },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_charges_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId },
        orderBy: { created_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_taxes_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId },
        orderBy: { created_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
        orderBy: { created_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_credit_apps_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
        orderBy: { applied_at: 'asc' },
      })
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_refunds_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
        orderBy: { created_at: 'asc' },
      })
    ),
    getDiscountLinesForOrder(tenantId, orderId),
  ]);

  try {
    adjustments = await prisma.$queryRaw<OrderAdjustmentRow[]>`
      SELECT
        a.id,
        a.adjustment_type,
        a.amount::float8 AS amount,
        a.currency_code,
        a.reason,
        a.status,
        a.approved_by,
        a.created_by,
        a.created_at,
        a.metadata
      FROM public.org_order_adjustments_dtl a
      WHERE a.tenant_org_id = ${tenantId}::uuid
        AND a.order_id = ${orderId}::uuid
        AND a.is_active = true
        AND a.rec_status = 1
      ORDER BY a.created_at ASC
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('org_order_adjustments_dtl')) {
      throw error;
    }
  }

  const totalRefundedAmount = refunds.reduce((sum, row) => {
    return row.refund_status === 'PROCESSED'
      ? sum + toNumber(row.refund_amount)
      : sum;
  }, 0);
  const normalizedPaymentStatus = normalizeOrderPaymentStatus(order.payment_status, {
    paymentTypeCode: order.payment_type_code ?? null,
    payOnCollectionAmount: toNumber(order.pay_on_collection_amount),
    outstandingAmount: toNumber(order.outstanding_amount),
  });

  const snapshot: OrderFinancialSnapshot = {
    orderId: order.id,
    orderNo: order.order_no ?? null,
    currencyCode: order.currency_code ?? null,
    paymentTypeCode: order.payment_type_code ?? null,
    paymentStatus: normalizedPaymentStatus,
    subtotalAmount: toNumber(order.subtotal),
    totalChargesAmount: toNumber(order.total_charges_amount),
    totalDiscountAmount: toNumber(order.total_discount_amount),
    totalTaxAmount: toNumber(order.total_tax_amount),
    totalAmount: toNumber(order.total),
    totalPaidAmount: toNumber(order.total_paid_amount),
    totalCreditAppliedAmount: toNumber(order.total_credit_applied_amount),
    totalRefundedAmount,
    outstandingAmount: toNumber(order.outstanding_amount),
    payOnCollectionAmount: toNumber(order.pay_on_collection_amount),
    giftCardAppliedAmount: toNumber(order.gift_card_applied_amount),
    changeReturnedAmount: toNumber(order.change_returned_amount),
  };

  const voucherReferences = [
    ...payments
      .filter((row) => row.fin_voucher_id || row.fin_voucher_trx_line_id)
      .map((row) => ({
        voucherId: row.fin_voucher_id ?? '',
        voucherLineId: row.fin_voucher_trx_line_id ?? null,
        source: 'PAYMENT' as const,
      })),
    ...refunds
      .map((row) => {
        const metadata = row.metadata as Record<string, unknown>;
        const voucherId = typeof metadata.fin_voucher_id === 'string' ? metadata.fin_voucher_id : '';
        const voucherLineId = typeof metadata.fin_voucher_trx_line_id === 'string'
          ? metadata.fin_voucher_trx_line_id
          : null;
        return voucherId || voucherLineId
          ? { voucherId, voucherLineId, source: 'REFUND' as const }
          : null;
      })
      .filter((row): row is { voucherId: string; voucherLineId: string | null; source: 'REFUND' } => row !== null),
    ...creditApplications
      .map((row) => {
        const metadata = row.metadata as Record<string, unknown>;
        const voucherId = typeof metadata.fin_voucher_id === 'string' ? metadata.fin_voucher_id : '';
        const voucherLineId = typeof metadata.fin_voucher_trx_line_id === 'string'
          ? metadata.fin_voucher_trx_line_id
          : null;
        return voucherId || voucherLineId
          ? { voucherId, voucherLineId, source: 'CREDIT_APPLICATION' as const }
          : null;
      })
      .filter((row): row is { voucherId: string; voucherLineId: string | null; source: 'CREDIT_APPLICATION' } => row !== null),
  ];

  const auditTimeline: OrderFinancialTimelineRow[] = [
    ...payments.map((row) => ({
      id: row.id,
      eventType: 'PAYMENT',
      status: row.payment_status,
      amount: toNumber(row.amount),
      happenedAt: toIso(row.created_at),
    })),
    ...creditApplications.map((row) => ({
      id: row.id,
      eventType: 'CREDIT_APPLICATION',
      status: row.credit_type,
      amount: toNumber(row.applied_amount),
      happenedAt: toIso(row.applied_at),
    })),
    ...refunds.map((row) => ({
      id: row.id,
      eventType: 'REFUND',
      status: row.refund_status,
      amount: toNumber(row.refund_amount),
      happenedAt: toIso(row.created_at),
    })),
    ...adjustments.map((row) => ({
      id: row.id,
      eventType: 'ADJUSTMENT',
      status: row.status,
      amount: toNumber(row.amount),
      happenedAt: toIso(row.created_at),
    })),
  ].sort((a, b) => a.happenedAt.localeCompare(b.happenedAt));

  return {
    snapshot,
    charges: charges.map((row) => ({
      id: row.id,
      charge_type: row.charge_type,
      label: row.label ?? null,
      label2: row.label2 ?? null,
      amount: toNumber(row.amount),
      currency_code: row.currency_code ?? null,
    })),
    discounts: discountLines.map((row) => ({
      id: row.id,
      source_type: row.source_type,
      source_name: row.source_name ?? null,
      discount_type: row.discount_type,
      discount_rate: row.discount_rate ?? null,
      discount_amount: row.discount_amount,
    })),
    taxes: taxes.map((row) => ({
      id: row.id,
      tax_type: row.tax_type,
      label: row.label,
      rate: toNumber(row.rate),
      tax_amount: toNumber(row.tax_amount),
      currency_code: row.currency_code,
    })),
    payments: payments.map((row) => ({
      id: row.id,
      payment_method_code: row.payment_method_code ?? null,
      payment_nature_snapshot: row.payment_nature_snapshot ?? null,
      amount: toNumber(row.amount),
      payment_status: row.payment_status ?? null,
      received_by: row.received_by ?? null,
      gateway_code: row.gateway_code ?? null,
      gateway_reference: row.gateway_reference ?? null,
      branch_payment_method_id: row.branch_payment_method_id ?? null,
      created_at: toIso(row.created_at),
    })),
    creditApplications: creditApplications.map((row) => ({
      id: row.id,
      credit_type: row.credit_type,
      credit_source_id: row.credit_source_id ?? null,
      applied_amount: toNumber(row.applied_amount),
      currency_code: row.currency_code,
      reference_no: row.reference_no ?? null,
      applied_by: row.applied_by ?? null,
      applied_at: toIso(row.applied_at),
    })),
    refunds: refunds.map((row) => ({
      id: row.id,
      refund_no: row.refund_no ?? null,
      refund_amount: toNumber(row.refund_amount),
      refund_status: row.refund_status ?? null,
      refund_method_code: row.refund_method_code ?? null,
      reason_code: row.reason_code ?? null,
      currency_code: row.currency_code ?? null,
      original_payment_id: row.original_payment_id ?? null,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: toIso(row.created_at),
    })),
    adjustments: adjustments.map((row) => ({
      ...row,
      amount: toNumber(row.amount),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      created_at: toIso(row.created_at),
    })),
    voucherReferences,
    auditTimeline,
  };
}
