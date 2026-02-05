/**
 * Server Action: Delete Order (rollback)
 * Used when invoice or payment step fails after order creation.
 * Validates input with Zod; deletes order and dependents with tenant check.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { deleteOrderInputSchema } from '@/lib/validations/new-order-payment-schemas';

export interface DeleteOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Delete an order and its dependents (rollback for new-order payment flow).
 * Enforces tenant context; only deletes orders for the given tenant.
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
    await withTenantContext(tenantId, async () => {
      await prisma.$transaction(async (tx) => {
        // Ensure order belongs to tenant
        const order = await tx.org_orders_mst.findFirst({
          where: { id, tenant_org_id: tenantId },
          select: { id: true },
        });
        if (!order) {
          throw new Error('Order not found or access denied');
        }

        // Get invoice ids for this order (to delete payments first)
        const invoices = await tx.org_invoice_mst.findMany({
          where: { order_id: id, tenant_org_id: tenantId },
          select: { id: true },
        });
        const invoiceIds = invoices.map((i) => i.id);

        if (invoiceIds.length > 0) {
          await tx.org_payments_dtl_tr.deleteMany({
            where: { invoice_id: { in: invoiceIds } },
          });
          await tx.org_invoice_mst.deleteMany({
            where: { order_id: id, tenant_org_id: tenantId },
          });
        }

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
