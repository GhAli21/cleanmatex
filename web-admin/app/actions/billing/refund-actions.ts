/**
 * Server Actions: Refunds
 *
 * getAllRefunds: list all refunds across orders for the tenant (billing-level view).
 * initiateOrderRefund: create a new refund record with PENDING_APPROVAL status.
 */

'use server';

import { getAuthContext } from '@/lib/auth/server-auth';
import { initiateRefund, getOrderRefunds } from '@/lib/services/order-refund.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { InitiateRefundParams } from '@/lib/services/order-refund.service';
import { Decimal } from '@prisma/client/runtime/library';

function toNumber(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 * List all refunds for the tenant (billing-level, not per-order).
 * @param page
 * @param pageSize
 */
export async function getAllRefunds(page = 1, pageSize = 20) {
  try {
    const auth = await getAuthContext();
    const skip = (page - 1) * pageSize;

    const [items, total] = await withTenantContext(auth.tenantId, () =>
      Promise.all([
        prisma.org_order_refunds_dtl.findMany({
          where: { tenant_org_id: auth.tenantId },
          orderBy: { created_at: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.org_order_refunds_dtl.count({
          where: { tenant_org_id: auth.tenantId },
        }),
      ])
    );

    /** Enrich with order_no via a single lookup for the order IDs in the page */
    const orderIds = [...new Set(items.map((r) => r.order_id))];
    const orders = orderIds.length
      ? await withTenantContext(auth.tenantId, () =>
          prisma.org_orders_mst.findMany({
            where: { id: { in: orderIds }, tenant_org_id: auth.tenantId },
            select: { id: true, order_no: true },
          })
        )
      : [];
    const orderNoMap = new Map(orders.map((o) => [o.id, o.order_no]));

    /** Serialize Decimal fields to plain numbers for RSC/client boundary */
    const serialized = items.map((r) => ({
      id:                 r.id,
      refund_no:          r.refund_no,
      order_id:           r.order_id,
      order_no:           orderNoMap.get(r.order_id) ?? null,
      refund_amount:      toNumber(r.refund_amount),
      currency_code:      r.currency_code,
      reason_code:        r.reason_code,
      refund_reason:      r.refund_reason,
      refund_method_code: r.refund_method_code,
      refund_status:      r.refund_status,
      created_by:         r.created_by,
      created_at:         r.created_at?.toISOString() ?? null,
      processed_at:       r.processed_at?.toISOString() ?? null,
    }));

    return {
      success: true as const,
      data: { items: serialized, total, page, pageSize },
    };
  } catch (error) {
    console.error('[getAllRefunds] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load refunds',
    };
  }
}

/**
 * Get refunds for a specific order.
 * @param orderId
 */
export async function getOrderRefundsAction(orderId: string) {
  try {
    const auth = await getAuthContext();
    const refunds = await getOrderRefunds(auth.tenantId, orderId);
    const serialized = refunds.map((r) => ({
      id:                 r.id,
      refund_no:          r.refund_no,
      order_id:           r.order_id,
      refund_amount:      toNumber(r.refund_amount),
      currency_code:      r.currency_code,
      reason_code:        r.reason_code,
      refund_reason:      r.refund_reason,
      refund_method_code: r.refund_method_code,
      refund_status:      r.refund_status,
      created_by:         r.created_by,
      created_at:         r.created_at?.toISOString() ?? null,
      processed_at:       r.processed_at?.toISOString() ?? null,
    }));
    return { success: true as const, data: serialized };
  } catch (error) {
    console.error('[getOrderRefundsAction] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load refunds',
    };
  }
}

/**
 * Initiate a new refund (creates PENDING_APPROVAL record).
 * @param params
 */
export async function initiateOrderRefund(
  params: Omit<InitiateRefundParams, 'requestedBy'>
) {
  try {
    const auth = await getAuthContext();
    const refund = await initiateRefund(auth.tenantId, {
      ...params,
      requestedBy: auth.userId,
    });
    return { success: true as const, data: refund };
  } catch (error) {
    console.error('[initiateOrderRefund] Error:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to initiate refund',
    };
  }
}
