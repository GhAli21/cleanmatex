import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import {
  CREDIT_APPLICATION_TYPES,
  ORDER_FINANCIAL_SNAPSHOT_STATUS,
  ORDER_FINANCIAL_WARNING_CODES,
  ORDER_PAYMENT_LIFECYCLE_STATUSES,
  ORDER_PAYMENT_STATUS,
  REFUND_METHODS,
  SETTLEMENT_TYPE_CODES,
  isArReceivablePaymentTypeCode,
} from '@/lib/constants/order-financial';
import type {
  OrderFinancialCalculationSnapshot,
  OrderFinancialWarningCode,
} from '@/lib/types/order-financial';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type PaymentFactRow = {
  amount: Decimal;
  payment_status: string | null;
  payment_nature_snapshot: string | null;
  payment_method_code: string | null;
  org_payment_method_id: string | null;
  gateway_code: string | null;
  gateway_reference: string | null;
  tendered_amount: Decimal | null;
  check_no: string | null;
  bank_reference: string | null;
  change_returned_amount: Decimal | null;
};

type RefundFactRow = {
  refund_amount: Decimal;
  refund_status: string | null;
  refund_method_code: string | null;
  original_payment_id: string | null;
  metadata: Prisma.JsonValue;
};

function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function normalizeUpper(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function toRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sumPaymentStatusAmount(rows: PaymentFactRow[], allowedStatuses: readonly string[]): number {
  const allowed = new Set<string>(allowedStatuses);

  return rows.reduce((sum, row) => {
    if (!allowed.has(normalizeUpper(row.payment_status))) return sum;
    if (!isClearlyRealPaymentRow(row)) return sum;
    return sum + toNumber(row.amount);
  }, 0);
}

function sumChangeReturned(rows: PaymentFactRow[]): number {
  const completed = new Set<string>(ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED);

  return rows.reduce((sum, row) => {
    if (!completed.has(normalizeUpper(row.payment_status))) return sum;
    if (!isClearlyRealPaymentRow(row)) return sum;
    return sum + toNumber(row.change_returned_amount);
  }, 0);
}

function isClearlyRealPaymentRow(row: PaymentFactRow): boolean {
  const snapshotNature = normalizeUpper(row.payment_nature_snapshot);
  if (snapshotNature === 'REAL_PAYMENT') return true;
  if (snapshotNature && snapshotNature !== 'REAL_PAYMENT') return false;

  return Boolean(
    row.org_payment_method_id
      || row.payment_method_code?.trim()
      || row.gateway_code?.trim()
      || row.gateway_reference?.trim()
      || row.tendered_amount != null
      || row.check_no?.trim()
      || row.bank_reference?.trim(),
  );
}

function hasAmbiguousHistoricalPaymentRow(rows: PaymentFactRow[]): boolean {
  return rows.some((row) => {
    if (row.payment_nature_snapshot != null) return false;
    return !isClearlyRealPaymentRow(row);
  });
}

function classifyRefunds(refunds: RefundFactRow[]): {
  refundedAmount: number;
  realPaymentRefundedAmount: number;
  storedValueRestoredAmount: number;
  customerCreditIssuedAmount: number;
  hasUnclassifiedRefundSource: boolean;
} {
  let refundedAmount = 0;
  let realPaymentRefundedAmount = 0;
  let storedValueRestoredAmount = 0;
  let customerCreditIssuedAmount = 0;
  let hasUnclassifiedRefundSource = false;

  for (const refund of refunds) {
    if (normalizeUpper(refund.refund_status) !== 'PROCESSED') continue;

    const amount = toNumber(refund.refund_amount);
    const method = normalizeUpper(refund.refund_method_code);
    const metadata = toRecord(refund.metadata);
    const refundDestinationType = String(metadata.refund_destination_type ?? '').trim().toUpperCase();
    const originalCreditType = String(metadata.original_credit_type ?? '').trim().toUpperCase();

    refundedAmount += amount;

    if (
      method === REFUND_METHODS.CASH
      || method === REFUND_METHODS.ORIGINAL_METHOD
      || Boolean(refund.original_payment_id)
    ) {
      realPaymentRefundedAmount += amount;
      continue;
    }

    if (
      method === REFUND_METHODS.WALLET
      || refundDestinationType === 'STORED_VALUE'
      || ['GIFT_CARD', CREDIT_APPLICATION_TYPES.WALLET, CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE, CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT].includes(originalCreditType)
    ) {
      storedValueRestoredAmount += amount;
      continue;
    }

    if (
      method === REFUND_METHODS.CREDIT_NOTE
      || refundDestinationType === 'CUSTOMER_CREDIT'
    ) {
      customerCreditIssuedAmount += amount;
      continue;
    }

    hasUnclassifiedRefundSource = true;
  }

  return {
    refundedAmount,
    realPaymentRefundedAmount,
    storedValueRestoredAmount,
    customerCreditIssuedAmount,
    hasUnclassifiedRefundSource,
  };
}

function resolveCanonicalTotalAmount(input: {
  itemsBaseAmount: number;
  totalChargesAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  roundingAdjustmentAmount: number;
  headerTotalAmount: number;
}): { totalAmount: number; usedHeaderTotalFallback: boolean } {
  const {
    itemsBaseAmount,
    totalChargesAmount,
    totalDiscountAmount,
    totalTaxAmount,
    roundingAdjustmentAmount,
    headerTotalAmount,
  } = input;

  const hasDetailComponents =
    itemsBaseAmount > 0
    || totalChargesAmount > 0
    || totalDiscountAmount > 0
    || totalTaxAmount > 0;

  if (hasDetailComponents) {
    return {
      totalAmount: Math.max(
        0,
        Number(
          (
            itemsBaseAmount
            + totalChargesAmount
            - totalDiscountAmount
            + totalTaxAmount
            + roundingAdjustmentAmount
          ).toFixed(4),
        ),
      ),
      usedHeaderTotalFallback: false,
    };
  }

  return {
    totalAmount: Math.max(0, Number(headerTotalAmount.toFixed(4))),
    usedHeaderTotalFallback: true,
  };
}

function buildWarningCodes(input: {
  usedHeaderTotalFallback: boolean;
  orderTotalAmount: number;
  recomputedTotalAmount: number;
  orderDiscountAmount: number;
  recomputedDiscountAmount: number;
  orderTaxAmount: number;
  recomputedTaxAmount: number;
  orderOutstandingAmount: number;
  recomputedOutstandingAmount: number;
  pendingPaymentAmount: number;
  authorizedPaymentAmount: number;
  giftCardAppliedAmount: number;
  totalCreditAppliedAmount: number;
  hasCreditApplicationDiscountRows: boolean;
  arInvoiceOutstandingAmount: number | null;
  arReceivableAmount: number;
  hasTaxDocumentAmountMismatch: boolean;
  hasUnclassifiedRefundSource: boolean;
  hasAmbiguousHistoricalPaymentRow: boolean;
}): OrderFinancialWarningCode[] {
  const warnings = new Set<OrderFinancialWarningCode>();
  const tolerance = 0.001;

  if (Math.abs(input.orderTotalAmount - input.recomputedTotalAmount) > tolerance) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.ORDER_TOTAL_COMPONENT_MISMATCH);
  }
  if (Math.abs(input.orderDiscountAmount - input.recomputedDiscountAmount) > tolerance) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.DISCOUNT_TOTAL_MISMATCH);
  }
  if (Math.abs(input.orderTaxAmount - input.recomputedTaxAmount) > tolerance) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.TAX_TOTAL_MISMATCH);
  }
  if (Math.abs(input.orderOutstandingAmount - input.recomputedOutstandingAmount) > tolerance) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.OUTSTANDING_MISMATCH);
  }
  if (input.pendingPaymentAmount > 0) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.PENDING_PAYMENT_COUNTED_AS_PAID);
  }
  if (input.authorizedPaymentAmount > 0) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.AUTHORIZED_PAYMENT_COUNTED_AS_PAID);
  }
  if (input.giftCardAppliedAmount > 0 && input.totalCreditAppliedAmount + tolerance < input.giftCardAppliedAmount) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.GIFT_CARD_DOUBLE_COUNTED);
  }
  if (input.hasCreditApplicationDiscountRows) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.CREDIT_APPLICATION_COUNTED_AS_DISCOUNT);
  }
  if (
    input.arInvoiceOutstandingAmount != null
    && Math.abs(input.arInvoiceOutstandingAmount - input.arReceivableAmount) > tolerance
  ) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.AR_RECEIVABLE_MISMATCH);
  }
  if (input.hasTaxDocumentAmountMismatch) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.TAX_DOCUMENT_TOTAL_MISMATCH);
  }
  if (input.hasUnclassifiedRefundSource) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.REFUND_SOURCE_UNCLASSIFIED);
  }
  if (input.hasAmbiguousHistoricalPaymentRow) {
    warnings.add(ORDER_FINANCIAL_WARNING_CODES.PAYMENT_TARGET_UNCLASSIFIED);
  }

  return [...warnings];
}

function resolveFinancialSnapshotStatus(
  warningCodes: OrderFinancialWarningCode[],
  usedHeaderTotalFallback: boolean,
): string {
  if (
    usedHeaderTotalFallback
    || warningCodes.includes(ORDER_FINANCIAL_WARNING_CODES.REFUND_SOURCE_UNCLASSIFIED)
    || warningCodes.includes(ORDER_FINANCIAL_WARNING_CODES.PAYMENT_TARGET_UNCLASSIFIED)
  ) {
    return ORDER_FINANCIAL_SNAPSHOT_STATUS.RECALCULATION_REQUIRED;
  }

  if (warningCodes.length > 0) {
    return ORDER_FINANCIAL_SNAPSHOT_STATUS.MISMATCH;
  }

  return ORDER_FINANCIAL_SNAPSHOT_STATUS.CURRENT;
}

function resolveHeaderPaymentStatus(input: {
  outstandingAmount: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  payOnCollectionAmount: number;
}): string {
  const settledAmount = input.totalPaidAmount + input.totalCreditAppliedAmount;

  if (input.outstandingAmount <= 0 && settledAmount > input.totalAmount) {
    return ORDER_PAYMENT_STATUS.OVERPAID;
  }
  if (input.outstandingAmount <= 0 && settledAmount > 0) {
    return ORDER_PAYMENT_STATUS.PAID;
  }
  if (settledAmount > 0) {
    return ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
  }
  if (input.payOnCollectionAmount > 0) {
    return ORDER_PAYMENT_STATUS.PENDING_COLLECTION;
  }
  return ORDER_PAYMENT_STATUS.UNPAID;
}

function buildFinancialCalculationSnapshot(input: {
  warningCodes: OrderFinancialWarningCode[];
  usedHeaderTotalFallback: boolean;
  hasAmbiguousHistoricalPaymentRow: boolean;
  hasUnclassifiedRefundSource: boolean;
  sourceTotals: Record<string, number | string | null>;
  derivedTotals: Record<string, number | string | null>;
  lineage: Record<string, string | null>;
}): OrderFinancialCalculationSnapshot {
  return {
    version: 4,
    warningCodes: input.warningCodes,
    usedLegacyTotalFallback: false,
    usedHeaderTotalFallback: input.usedHeaderTotalFallback,
    hasPaymentTargetUnclassified: input.hasAmbiguousHistoricalPaymentRow,
    hasRefundSourceUnclassified: input.hasUnclassifiedRefundSource,
    sourceTotals: input.sourceTotals,
    derivedTotals: input.derivedTotals,
    lineage: input.lineage,
    notes: [
      'subtotalAmount and itemsBaseAmount are intentionally equal in the current pricing mode because extras are already embedded in item line totals.',
      'Header total fallback remains temporary until 0335 removes legacy mirrors and every order-header write path is fully canonicalized.',
    ],
  };
}

function buildFinancialCalculationHash(snapshot: OrderFinancialCalculationSnapshot): string {
  return createHash('md5').update(JSON.stringify(snapshot)).digest('hex');
}

/**
 * Why:
 * Financial snapshot persistence must use one recalculation path after every
 * mutation. This keeps settlement, later collection, refunds, credits, and
 * adjustments from drifting into different header math.
 */

/**
 * Recalculate and persist the Order Fin snapshot from current fact rows.
 *
 * @param tx current transaction client so all reads and writes remain atomic
 * @param tenantId authenticated tenant identifier
 * @param orderId order header identifier
 * @returns normalized totals written back to the order header
 */
export async function recalculateOrderFinancialSnapshotTx(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<{
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  refundedAmount: number;
  realPaymentRefundedAmount: number;
  netCollectedAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
  payOnCollectionAmount: number;
  arReceivableAmount: number;
  financialSnapshotStatus: string;
}> {
  const order = await tx.org_orders_mst.findFirstOrThrow({
    where: { tenant_org_id: tenantId, id: orderId },
    select: {
      id: true,
      total_discount_amount: true,
      total_tax_amount: true,
      outstanding_amount: true,
      payment_type_code: true,
      rounding_adjustment_amount: true,
      total_amount: true,
      tax_document_id: true,
    },
  });

  const [
    itemAgg,
    pieceAgg,
    preferenceAgg,
    charges,
    discountsAgg,
    taxesAgg,
    payments,
    creditAgg,
    creditRows,
    discountRows,
    refunds,
    invoiceLink,
  ] = await Promise.all([
    tx.org_order_items_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      _sum: { total_price: true },
    }),
    tx.org_order_item_pieces_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      _sum: { service_pref_charge: true },
    }),
    tx.org_order_preferences_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      _sum: { extra_price: true },
    }),
    tx.org_order_charges_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_voided: false },
      select: { amount: true, charge_type: true },
    }),
    tx.org_order_discounts_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, is_voided: false },
      _sum: { discount_amount: true },
    }),
    tx.org_order_taxes_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      _sum: { tax_amount: true, taxable_amount: true },
    }),
    tx.org_order_payments_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      select: {
        amount: true,
        payment_status: true,
        payment_nature_snapshot: true,
        payment_method_code: true,
        org_payment_method_id: true,
        gateway_code: true,
        gateway_reference: true,
        tendered_amount: true,
        check_no: true,
        bank_reference: true,
        change_returned_amount: true,
      },
    }),
    tx.org_order_credit_apps_dtl.aggregate({
      where: {
        tenant_org_id: tenantId,
        order_id: orderId,
        is_active: true,
        rec_status: 1,
      },
      _sum: { applied_amount: true },
    }),
    tx.org_order_credit_apps_dtl.findMany({
      where: {
        tenant_org_id: tenantId,
        order_id: orderId,
        is_active: true,
        rec_status: 1,
      },
      select: {
        credit_type: true,
        applied_amount: true,
      },
    }),
    tx.org_order_discounts_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_voided: false },
      select: { source_type: true },
    }),
    tx.org_order_refunds_dtl.findMany({
      where: {
        tenant_org_id: tenantId,
        order_id: orderId,
        is_active: true,
      },
      select: {
        refund_amount: true,
        refund_status: true,
        refund_method_code: true,
        original_payment_id: true,
        metadata: true,
      },
    }),
    tx.org_invoice_orders_dtl.findFirst({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: [{ created_at: 'desc' }],
      select: {
        invoice_id: true,
        org_invoice_mst: {
          select: {
            id: true,
            invoice_no: true,
            status: true,
            outstanding_amount: true,
          },
        },
      },
    }),
  ]);

  const itemsBaseAmount = toNumber(itemAgg._sum.total_price);
  const subtotalAmount = itemsBaseAmount;
  const pieceExtraPriceAmount = toNumber(pieceAgg._sum.service_pref_charge);
  const preferenceExtraPriceAmount = toNumber(preferenceAgg._sum.extra_price);
  const totalChargesAmount = charges.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const serviceChargeAmount = charges
    .filter((row) => ['SERVICE', 'SERVICE_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const deliveryChargeAmount = charges
    .filter((row) => ['DELIVERY', 'DELIVERY_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expressChargeAmount = charges
    .filter((row) => ['EXPRESS', 'EXPRESS_CHARGE'].includes(normalizeUpper(row.charge_type)))
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const otherChargesAmount = Math.max(
    0,
    totalChargesAmount - serviceChargeAmount - deliveryChargeAmount - expressChargeAmount,
  );
  const totalDiscountAmount = toNumber(discountsAgg._sum.discount_amount);
  const totalTaxAmount = toNumber(taxesAgg._sum.tax_amount);
  const taxableAmount = toNumber(taxesAgg._sum.taxable_amount)
    || Math.max(0, subtotalAmount + totalChargesAmount - totalDiscountAmount);
  const totalCreditAppliedAmount = toNumber(creditAgg._sum.applied_amount);
  const giftCardCreditAppliedAmount = creditRows
    .filter((row) => normalizeUpper(row.credit_type) === CREDIT_APPLICATION_TYPES.GIFT_CARD)
    .reduce((sum, row) => sum + toNumber(row.applied_amount), 0);
  const totalPaidAmount = sumPaymentStatusAmount(payments, ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED);
  const pendingPaymentAmount = sumPaymentStatusAmount(payments, ORDER_PAYMENT_LIFECYCLE_STATUSES.PENDING);
  const authorizedPaymentAmount = sumPaymentStatusAmount(payments, ORDER_PAYMENT_LIFECYCLE_STATUSES.AUTHORIZED);
  const failedPaymentAmount = sumPaymentStatusAmount(payments, ORDER_PAYMENT_LIFECYCLE_STATUSES.FAILED);
  const changeReturnedAmount = sumChangeReturned(payments);
  const ambiguousHistoricalPaymentRow = hasAmbiguousHistoricalPaymentRow(payments);

  const {
    refundedAmount,
    realPaymentRefundedAmount,
    storedValueRestoredAmount,
    customerCreditIssuedAmount,
    hasUnclassifiedRefundSource,
  } = classifyRefunds(refunds);

  const roundingAdjustmentAmount = toNumber(order.rounding_adjustment_amount);
  const { totalAmount, usedHeaderTotalFallback } = resolveCanonicalTotalAmount({
    itemsBaseAmount,
    totalChargesAmount,
    totalDiscountAmount,
    totalTaxAmount,
    roundingAdjustmentAmount,
    headerTotalAmount: toNumber(order.total_amount),
  });

  const refundReopensDueAmount = 0;
  const creditReversalReopensDueAmount = 0;
  const creditReversedAmount = 0;
  const netCollectedAmount = Math.max(0, totalPaidAmount - realPaymentRefundedAmount);
  const outstandingAmount = Math.max(
    0,
    totalAmount
      - totalPaidAmount
      - totalCreditAppliedAmount
      + refundReopensDueAmount
      + creditReversalReopensDueAmount,
  );
  const overpaidAmount = Math.max(0, totalPaidAmount + totalCreditAppliedAmount - totalAmount);
  const payOnCollectionAmount =
    order.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION
      ? outstandingAmount
      : 0;
  const arReceivableAmount = isArReceivablePaymentTypeCode(order.payment_type_code)
    ? outstandingAmount
    : 0;

  const arInvoice = invoiceLink?.org_invoice_mst ?? null;
  const warningCodes = buildWarningCodes({
    usedHeaderTotalFallback,
    orderTotalAmount: toNumber(order.total_amount),
    recomputedTotalAmount: totalAmount,
    orderDiscountAmount: toNumber(order.total_discount_amount),
    recomputedDiscountAmount: totalDiscountAmount,
    orderTaxAmount: toNumber(order.total_tax_amount),
    recomputedTaxAmount: totalTaxAmount,
    orderOutstandingAmount: toNumber(order.outstanding_amount),
    recomputedOutstandingAmount: outstandingAmount,
    pendingPaymentAmount,
    authorizedPaymentAmount,
    giftCardAppliedAmount: giftCardCreditAppliedAmount,
    totalCreditAppliedAmount,
    hasCreditApplicationDiscountRows: discountRows.some((row) => {
      const sourceType = normalizeUpper(row.source_type);
      return Object.values(CREDIT_APPLICATION_TYPES).includes(sourceType as never);
    }),
    arInvoiceOutstandingAmount: arInvoice?.outstanding_amount != null ? toNumber(arInvoice.outstanding_amount) : null,
    arReceivableAmount,
    hasTaxDocumentAmountMismatch: Boolean(order.tax_document_id) && Math.abs(arReceivableAmount - totalAmount) > 0.001,
    hasUnclassifiedRefundSource,
    hasAmbiguousHistoricalPaymentRow: ambiguousHistoricalPaymentRow,
  });

  const financialSnapshotStatus = resolveFinancialSnapshotStatus(warningCodes, usedHeaderTotalFallback);
  const paymentStatus = resolveHeaderPaymentStatus({
    outstandingAmount,
    totalAmount,
    totalPaidAmount,
    totalCreditAppliedAmount,
    payOnCollectionAmount,
  });

  const sourceTotals = {
    headerTotalAmount: toNumber(order.total_amount),
    headerOutstandingAmount: toNumber(order.outstanding_amount),
    giftCardCreditAppliedAmount,
    headerDiscountAmount: toNumber(order.total_discount_amount),
    headerTaxAmount: toNumber(order.total_tax_amount),
  };

  const derivedTotals = {
    subtotalAmount,
    itemsBaseAmount,
    pieceExtraPriceAmount,
    preferenceExtraPriceAmount,
    totalChargesAmount,
    serviceChargeAmount,
    deliveryChargeAmount,
    expressChargeAmount,
    otherChargesAmount,
    totalDiscountAmount,
    taxableAmount,
    totalTaxAmount,
    roundingAdjustmentAmount,
    totalAmount,
    totalPaidAmount,
    pendingPaymentAmount,
    authorizedPaymentAmount,
    failedPaymentAmount,
    totalCreditAppliedAmount,
    refundedAmount,
    realPaymentRefundedAmount,
    storedValueRestoredAmount,
    customerCreditIssuedAmount,
    netCollectedAmount,
    refundReopensDueAmount,
    creditReversalReopensDueAmount,
    creditReversedAmount,
    outstandingAmount,
    overpaidAmount,
    payOnCollectionAmount,
    arReceivableAmount,
  };

  const calculationSnapshot = buildFinancialCalculationSnapshot({
    warningCodes,
    usedHeaderTotalFallback,
    hasAmbiguousHistoricalPaymentRow: ambiguousHistoricalPaymentRow,
    hasUnclassifiedRefundSource,
    sourceTotals,
    derivedTotals,
    lineage: {
      arInvoiceId: arInvoice?.id ?? null,
      arInvoiceNo: arInvoice?.invoice_no ?? null,
      arInvoiceStatus: arInvoice?.status ?? null,
      taxDocumentId: null,
      taxDocumentNo: null,
      taxDocumentStatus: null,
      taxDocumentType: null,
    },
  });
  const financialCalculationHash = buildFinancialCalculationHash(calculationSnapshot);
  const financialCalculationTraceId = randomUUID();

  await tx.org_orders_mst.update({
    where: { id: orderId, tenant_org_id: tenantId },
    data: {
      subtotal_amount: subtotalAmount,
      items_base_amount: itemsBaseAmount,
      total_amount: totalAmount,
      piece_extra_price_amount: pieceExtraPriceAmount,
      preference_extra_price_amount: preferenceExtraPriceAmount,
      total_charges_amount: totalChargesAmount,
      service_charge_amount: serviceChargeAmount,
      delivery_charge_amount: deliveryChargeAmount,
      express_charge_amount: expressChargeAmount,
      other_charges_amount: otherChargesAmount,
      total_discount_amount: totalDiscountAmount,
      taxable_amount: taxableAmount,
      total_tax_amount: totalTaxAmount,
      total_credit_applied_amount: totalCreditAppliedAmount,
      total_paid_amount: totalPaidAmount,
      refunded_amount: refundedAmount,
      real_payment_refunded_amount: realPaymentRefundedAmount,
      stored_value_restored_amount: storedValueRestoredAmount,
      customer_credit_issued_amount: customerCreditIssuedAmount,
      net_collected_amount: netCollectedAmount,
      pending_payment_amount: pendingPaymentAmount,
      authorized_payment_amount: authorizedPaymentAmount,
      failed_payment_amount: failedPaymentAmount,
      refund_reopens_due_amount: refundReopensDueAmount,
      credit_reversal_reopens_due_amount: creditReversalReopensDueAmount,
      credit_reversed_amount: creditReversedAmount,
      ar_receivable_amount: arReceivableAmount,
      ar_invoice_id: arInvoice?.id ?? null,
      ar_invoice_no: arInvoice?.invoice_no ?? null,
      ar_invoice_status: arInvoice?.status ?? null,
      outstanding_amount: outstandingAmount,
      overpaid_amount: overpaidAmount,
      payment_status: paymentStatus,
      pay_on_collection_amount: payOnCollectionAmount > 0 ? payOnCollectionAmount : null,
      change_returned_amount: changeReturnedAmount > 0 ? changeReturnedAmount : null,
      financial_engine_version: 4,
      financial_last_calculated_at: new Date(),
      financial_last_calculated_by: 'service:recalculateOrderFinancialSnapshotTx',
      financial_snapshot_status: financialSnapshotStatus,
      financial_mismatch_warning_count: warningCodes.length,
      financial_calculation_snapshot: calculationSnapshot as Prisma.InputJsonValue,
      financial_calculation_hash: financialCalculationHash,
      financial_calculation_trace_id: financialCalculationTraceId,
      updated_at: new Date(),
    },
  });

  return {
    totalPaidAmount,
    totalCreditAppliedAmount,
    refundedAmount,
    realPaymentRefundedAmount,
    netCollectedAmount,
    outstandingAmount,
    paymentStatus,
    payOnCollectionAmount,
    arReceivableAmount,
    financialSnapshotStatus,
  };
}

/**
 * Why:
 * Some transitional flows still create order headers outside a Prisma
 * transaction. They still need the same canonical snapshot refresh before the
 * caller returns, so this wrapper reuses the tx-safe recalculator instead of
 * forking the math.
 */
export async function recalculateOrderFinancialSnapshot(
  tenantId: string,
  orderId: string,
) {
  return prisma.$transaction((tx) =>
    recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId),
  );
}
