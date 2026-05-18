import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '../db/tenant-context';
import {
  REFUND_METHODS,
  OUTBOX_EVENT_TYPES,
  STORED_VALUE_TXN_TYPES,
  CREDIT_NOTE_STATUSES,
} from '@/lib/constants/order-financial';
import type { RefundMethod, RefundReasonCode } from '@/lib/types/order-financial';
import { emitEventTx } from './outbox.service';
import { topUpWalletTx, issueCreditNote } from './stored-value.service';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

export interface InitiateRefundParams {
  orderId:      string;
  amount:       number;
  reason:       RefundReasonCode;
  method:       RefundMethod;
  notes?:       string;
  requestedBy:  string;
  currencyCode: string;
}

/**
 * Initiate a refund for an order. Creates the refund record with PENDING_APPROVAL status.
 * Manager approval is required before actual reversal.
 */
export async function initiateRefund(tenantId: string, params: InitiateRefundParams) {
  const { orderId, amount, reason, method, notes, requestedBy, currencyCode } = params;

  const order = await withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findFirstOrThrow({
      where: { id: orderId, tenant_org_id: tenantId },
    })
  );

  const totalPaid = toNumber(order.total_paid_amount);
  if (amount > totalPaid) throw new Error(`Refund amount (${amount}) exceeds total paid (${totalPaid})`);

  const count = await withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.count({ where: { tenant_org_id: tenantId } })
  );
  const refundNo = `REF-${String(count + 1).padStart(6, '0')}`;

  return withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.create({
      data: {
        tenant_org_id:     tenantId,
        order_id:          orderId,
        refund_no:         refundNo,
        refund_amount:     amount,
        currency_code:     currencyCode,
        reason_code:       reason,
        refund_reason:     params.notes ?? null,
        refund_method_code: method,
        refund_status:     'PENDING_APPROVAL',
        created_by:        requestedBy,
        is_active:         true,
        rec_status:        1,
      },
    })
  );
}

/**
 * Manager approval gate — moves refund from PENDING_APPROVAL → APPROVED.
 */
export async function approveRefund(tenantId: string, refundId: string, approverId: string) {
  const refund = await withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.findFirstOrThrow({
      where: { id: refundId, tenant_org_id: tenantId, refund_status: 'PENDING_APPROVAL' },
    })
  );

  return withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.update({
      where: { id: refund.id },
      data:  { refund_status: 'APPROVED', approved_by: approverId, approved_at: new Date(), updated_at: new Date() },
    })
  );
}

/**
 * Process an approved refund — performs the actual reversal and emits outbox event.
 */
export async function processRefund(tenantId: string, refundId: string) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.org_order_refunds_dtl.findFirstOrThrow({
      where: { id: refundId, tenant_org_id: tenantId, refund_status: 'APPROVED' },
    });

    const order = await tx.org_orders_mst.findFirstOrThrow({
      where: { id: refund.order_id, tenant_org_id: tenantId },
    });

    const amount      = toNumber(refund.refund_amount);
    const method      = refund.refund_method_code as RefundMethod;
    const customerId  = order.customer_id;

    // Execute the reversal by method
    if (method === REFUND_METHODS.WALLET && customerId) {
      await topUpWalletTx(tx, {
        tenantId,
        customerId,
        amount,
        orderId:  order.id,
        notes:    `Refund for order ${order.order_no}`,
      });
    } else if (method === REFUND_METHODS.CREDIT_NOTE && customerId) {
      await issueCreditNote(tenantId, {
        customerId,
        amount,
        reason:       `Refund for order ${order.order_no}`,
        orderId:      order.id,
        currencyCode: (order.currency_code as string) ?? 'OMR',
      });
    }
    // CASH / ORIGINAL_METHOD — physical reversal tracked only via status; no ledger write needed

    const updated = await tx.org_order_refunds_dtl.update({
      where: { id: refundId },
      data:  {
        refund_status: 'PROCESSED',
        processed_at:  new Date(),
        updated_at:    new Date(),
      },
    });

    // Update order payment status
    await tx.org_orders_mst.update({
      where: { id: order.id },
      data:  {
        payment_status: 'PARTIALLY_REFUNDED',
        updated_at:     new Date(),
      },
    });

    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.REFUND_PROCESSED, 'order', order.id, {
      refundId,
      amount,
      method,
      customerId,
    });

    return updated;
  });
}

export async function getOrderRefunds(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where:   { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'desc' },
    })
  );
}
