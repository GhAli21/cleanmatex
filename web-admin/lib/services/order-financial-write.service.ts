import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { ORDER_PAYMENT_STATUS, SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
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
  orderId: string
): Promise<{
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  totalRefundedAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
  payOnCollectionAmount: number;
}> {
  const order = await tx.org_orders_mst.findFirstOrThrow({
    where: { tenant_org_id: tenantId, id: orderId },
    select: {
      id: true,
      subtotal: true,
      total: true,
      payment_type_code: true,
      pay_on_collection_amount: true,
      currency_code: true,
    },
  });

  const [
    chargesAgg,
    discountsAgg,
    taxesAgg,
    payments,
    creditAgg,
    refundAgg,
  ] = await Promise.all([
    tx.org_order_charges_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, is_voided: false },
      _sum: { amount: true },
    }),
    tx.org_order_discounts_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, is_voided: false },
      _sum: { discount_amount: true },
    }),
    tx.org_order_taxes_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      _sum: { tax_amount: true },
    }),
    tx.org_order_payments_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      select: {
        amount: true,
        payment_status: true,
        change_returned_amount: true,
      },
    }),
    tx.org_order_credit_apps_dtl.aggregate({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      _sum: { applied_amount: true },
    }),
    tx.org_order_refunds_dtl.aggregate({
      where: {
        tenant_org_id: tenantId,
        order_id: orderId,
        is_active: true,
        refund_status: 'PROCESSED',
      },
      _sum: { refund_amount: true },
    }),
  ]);

  const totalChargesAmount = toNumber(chargesAgg._sum.amount);
  const totalDiscountAmount = toNumber(discountsAgg._sum.discount_amount);
  const totalTaxAmount = toNumber(taxesAgg._sum.tax_amount);
  const totalPaidAmount = payments
    .filter((row) => row.payment_status === 'COMPLETED')
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalCreditAppliedAmount = toNumber(creditAgg._sum.applied_amount);
  const totalRefundedAmount = toNumber(refundAgg._sum.refund_amount);
  const changeReturnedAmount = payments
    .filter((row) => row.payment_status === 'COMPLETED')
    .reduce((sum, row) => sum + toNumber(row.change_returned_amount), 0);

  const totalAmount = toNumber(order.total);
  const completedValue = totalPaidAmount + totalCreditAppliedAmount;
  const outstandingAmount = Math.max(0, totalAmount - completedValue + totalRefundedAmount);
  const netAppliedAmount = completedValue - totalRefundedAmount;

  let paymentStatus: string;
  if (outstandingAmount <= 0 && netAppliedAmount > totalAmount) {
    paymentStatus = ORDER_PAYMENT_STATUS.OVERPAID;
  } else if (outstandingAmount <= 0 && netAppliedAmount > 0) {
    paymentStatus = ORDER_PAYMENT_STATUS.PAID;
  } else if (netAppliedAmount > 0) {
    paymentStatus = ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
  } else if (
    order.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION
    || toNumber(order.pay_on_collection_amount) > 0
  ) {
    paymentStatus = ORDER_PAYMENT_STATUS.PENDING_COLLECTION;
  } else {
    paymentStatus = ORDER_PAYMENT_STATUS.UNPAID;
  }

  const payOnCollectionAmount =
    outstandingAmount > 0 && order.payment_type_code === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION
      ? outstandingAmount
      : 0;

  await tx.org_orders_mst.update({
    where: { id: orderId, tenant_org_id: tenantId },
    data: {
      total_charges_amount: totalChargesAmount,
      total_discount_amount: totalDiscountAmount,
      total_tax_amount: totalTaxAmount,
      total_credit_applied_amount: totalCreditAppliedAmount,
      total_paid_amount: totalPaidAmount,
      net_receivable_amount: Math.max(0, totalAmount - totalCreditAppliedAmount),
      outstanding_amount: outstandingAmount,
      payment_status: paymentStatus,
      pay_on_collection_amount: payOnCollectionAmount > 0 ? payOnCollectionAmount : null,
      change_returned_amount: changeReturnedAmount > 0 ? changeReturnedAmount : null,
      financial_engine_version: 2,
      updated_at: new Date(),
    },
  });

  return {
    totalPaidAmount,
    totalCreditAppliedAmount,
    totalRefundedAmount,
    outstandingAmount,
    paymentStatus,
    payOnCollectionAmount,
  };
}
