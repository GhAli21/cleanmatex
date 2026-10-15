/**
 * Loads follow-up facts and executes stored-value resolution through the
 * existing disposition owner. It does not change the original payment type,
 * collect a new tender, or start a refund.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { executeOverpaymentDispositionTx } from '@/lib/services/overpayment-disposition.service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import {
  planOrderChangeFollowUp,
  resolutionAmountWithinCap,
  type OrderChangeFollowUpActionCode,
  type OrderChangeFollowUpPlan,
} from '@/lib/services/order-change/order-change-follow-up';

const STORED_VALUE = new Set<string>([
  OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE,
  OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
  OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET,
]);

export class OrderChangeFollowUpError extends Error {
  constructor(readonly status: 404 | 422, readonly code: string) {
    super(code);
  }
}

export async function loadOrderChangeFollowUp(
  tenantId: string,
  orderId: string,
): Promise<OrderChangeFollowUpPlan | null> {
  const order = await prisma.org_orders_mst.findFirst({
    where: { id: orderId, tenant_org_id: tenantId },
    select: {
      payment_type_code: true,
      outstanding_amount: true,
      overpaid_amount: true,
      currency_code: true,
      customer_id: true,
    },
  });
  if (!order) return null;
  return planOrderChangeFollowUp({
    paymentTypeCode: order.payment_type_code,
    outstandingAmount: decimalText(order.outstanding_amount),
    overpaidAmount: decimalText(order.overpaid_amount),
    currencyCode: order.currency_code,
    hasCustomer: order.customer_id != null,
  });
}

export async function executeOrderChangeStoredValueResolution(input: {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  resolutionCode: OrderChangeFollowUpActionCode;
  amount: string;
  noteReason?: string;
  idempotencyKey: string;
}): Promise<{ resolutionCode: string; amount: string }> {
  if (!STORED_VALUE.has(input.resolutionCode)) {
    throw new OrderChangeFollowUpError(422, 'RESOLUTION_NOT_AVAILABLE');
  }
  return withTenantContext(input.tenantId, () => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      overpaid_amount: string;
      currency_code: string | null;
      customer_id: string | null;
      branch_id: string | null;
    }>>`
      SELECT overpaid_amount::text AS overpaid_amount,
             currency_code,
             customer_id::text AS customer_id,
             branch_id::text AS branch_id
      FROM org_orders_mst
      WHERE id = ${input.orderId}::uuid
        AND tenant_org_id = ${input.tenantId}::uuid
      FOR UPDATE
    `;
    const order = rows[0];
    if (!order) throw new OrderChangeFollowUpError(404, 'ORDER_NOT_FOUND');
    if (!order.currency_code) throw new OrderChangeFollowUpError(422, 'CURRENCY_UNRESOLVED');
    if (!order.customer_id) throw new OrderChangeFollowUpError(422, 'CUSTOMER_REQUIRED');
    if (!resolutionAmountWithinCap(order.overpaid_amount, input.amount)) {
      throw new OrderChangeFollowUpError(422, 'AMOUNT_EXCEEDS_SOURCE');
    }
    const amount = Number(input.amount);
    const lines = input.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT
      ? [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT, amount, noteReason: input.noteReason }]
      : input.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET
        ? [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET, amount }]
        : [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE, amount }];
    await executeOverpaymentDispositionTx({
      tx,
      tenantId: input.tenantId,
      userId: input.actorUserId,
      orderId: input.orderId,
      branchId: order.branch_id,
      customerId: order.customer_id,
      currencyCode: order.currency_code,
      resolution: { excessAmount: amount, lines },
      idempotencyKey: input.idempotencyKey,
    });
    await recalculateOrderFinancialSnapshotTx(tx, input.tenantId, input.orderId);
    return { resolutionCode: input.resolutionCode, amount: amount.toFixed(4) };
  }));
}

function decimalText(value: { toString(): string } | null): string {
  return value == null ? '0.0000' : Number(value.toString()).toFixed(4);
}
