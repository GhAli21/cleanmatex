import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { emitEventTx } from '@/lib/services/outbox.service';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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
