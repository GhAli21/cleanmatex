/**
 * Server Action: compensate a failed order creation.
 *
 * This is deliberately not a general order-deletion path: it may remove only an
 * aggregate that has not acquired immutable commercial commitment evidence.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { deleteOrderInputSchema } from '@/lib/validations/new-order-payment-schemas';

/**
 * Outcome returned by failed-create compensation.
 * A failure is returned rather than thrown so the original Create flow can surface
 * its own error while preserving the reason compensation was denied.
 */
export interface DeleteOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Compensate an uncommitted order and its dependent records after Create fails.
 *
 * Tenant identity is resolved server-side from the authenticated session; the
 * supplied tenant ID is only a value to verify against that authority.
 *
 * @param tenantOrgId - Tenant expected by the caller; must match authenticated membership.
 * @param orderId - Uncommitted aggregate eligible for failed-create compensation.
 * @returns A structured result; committed orders are refused without deleting dependents.
 */
export async function deleteOrderAction(
  tenantOrgId: string,
  orderId: string
): Promise<DeleteOrderResult> {
  const parsed = deleteOrderInputSchema.safeParse({ orderId, tenantOrgId });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input',
    };
  }

  const { orderId: id, tenantOrgId: tenantId } = parsed.data;

  try {
    // Tenant resolved server-side from the authenticated session — never trust a caller-supplied tenant ID.
    const auth = await getAuthContext();
    if (auth.tenantId !== tenantId) {
      return { success: false, error: 'Order not found or access denied' };
    }
    if (!(await hasPermissionServer(ORDERS_PERMISSIONS.DELETE))) {
      return { success: false, error: 'Permission denied' };
    }

    await withTenantContext(tenantId, async () => {
      await prisma.$transaction(async (tx) => {
        // Failed-create compensation may only remove a still-uncommitted aggregate.
        // Commitment facts are immutable and must never be erased by this legacy path.
        const order = await tx.org_orders_mst.findFirst({
          where: { id, tenant_org_id: tenantId },
          select: { id: true, committed_at: true },
        });
        if (!order) {
          throw new Error('Order not found or access denied');
        }
        if (order.committed_at !== null) {
          throw new Error('Committed orders cannot be deleted as failed Create compensation');
        }

        await tx.org_invoice_mst.deleteMany({
          where: { order_id: id, tenant_org_id: tenantId },
        });

        await tx.org_order_item_pieces_dtl.deleteMany({
          where: { order_id: id, tenant_org_id: tenantId },
        });
        await tx.org_order_items_dtl.deleteMany({
          where: { order_id: id, tenant_org_id: tenantId },
        });
        await tx.org_order_status_history.deleteMany({
          where: { order_id: id, tenant_org_id: tenantId },
        });
        await tx.org_orders_mst.delete({
          where: { id, tenant_org_id: tenantId },
        });
      });
    });

    // Cache invalidation: remove the compensated aggregate from the order list and detail-route cache.
    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${id}`);

    return { success: true };
  } catch (error) {
    console.error('Delete order failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete order',
    };
  }
}
