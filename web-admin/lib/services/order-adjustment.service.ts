import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { emitEventTx } from '@/lib/services/outbox.service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Adjustment creation payload for the Order Fin controlled-correction ledger.
 */
export interface CreateOrderAdjustmentParams {
  tenantId: string;
  orderId: string;
  adjustmentType: string;
  amount: number;
  currencyCode: string;
  reason: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
  autoApprove?: boolean;
}

/**
 * Create an order-level financial adjustment row under tenant scope.
 *
 * Why:
 * Adjustments are intentionally isolated from discounts, payments, and refunds
 * so finance teams can audit exceptional corrections without mutating the
 * original source facts.
 *
 * @param params tenant-scoped adjustment payload
 * @returns created adjustment row metadata
 * @example
 * await createOrderAdjustment({
 *   tenantId: 'org-123',
 *   orderId: 'order-123',
 *   adjustmentType: 'MANUAL_CORRECTION',
 *   amount: -2.5,
 *   currencyCode: 'OMR',
 *   reason: 'Rounded down after review',
 *   createdBy: 'user-123',
 * });
 */
export async function createOrderAdjustment(
  params: CreateOrderAdjustmentParams
) {
  const {
    tenantId,
    orderId,
    adjustmentType,
    amount,
    currencyCode,
    reason,
    createdBy,
    metadata,
    autoApprove = false,
  } = params;

  if (amount === 0) {
    throw new Error('Adjustment amount must be non-zero');
  }
  if (!reason.trim()) {
    throw new Error('Adjustment reason is required');
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const order = await tx.org_orders_mst.findFirstOrThrow({
      where: { id: orderId, tenant_org_id: tenantId },
      select: { id: true, order_no: true },
    });

    const status = autoApprove ? 'APPROVED' : 'PENDING_APPROVAL';

    const row = await tx.$queryRaw<
      Array<{ id: string; order_id: string; status: string }>
    >`
      INSERT INTO public.org_order_adjustments_dtl (
        tenant_org_id,
        order_id,
        adjustment_type,
        amount,
        currency_code,
        reason,
        status,
        approved_by,
        approved_at,
        metadata,
        created_by,
        rec_status,
        is_active
      )
      VALUES (
        ${tenantId}::uuid,
        ${orderId}::uuid,
        ${adjustmentType},
        ${amount},
        ${currencyCode},
        ${reason},
        ${status},
        ${autoApprove ? createdBy : null}::uuid,
        ${autoApprove ? new Date() : null}::timestamptz,
        ${JSON.stringify(metadata ?? {})}::jsonb,
        ${createdBy},
        1,
        true
      )
      RETURNING id, order_id, status
    `;

    const created = row[0];

    // Recompute the header snapshot after approved adjustments so downstream
    // finance reads stay aligned even though Batch 0 keeps header columns lean.
    if (status === 'APPROVED') {
      await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);
    }

    await emitEventTx(
      tx,
      tenantId,
      OUTBOX_EVENT_TYPES.ORDER_FINANCIAL_ADJUSTMENT_CREATED,
      'order',
      order.id,
      {
        orderId: order.id,
        orderNo: order.order_no,
        adjustmentId: created.id,
        adjustmentType,
        amount,
        currencyCode,
        reason,
        status,
      }
    );

    return created;
  });
}
