/**
 * Server Action: Add Order Items
 *
 * Adds items to an order during the preparation workflow.
 * Automatically calculates pricing, tax, and updates order totals.
 * Tenant comes from the session; a caller-supplied tenant id is only verified (BF-20).
 */

'use server';

import { revalidatePath } from 'next/cache';
import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { addOrderItemsSchema } from '@/lib/validations/order-schema';
import { addOrderItems as addOrderItemsDb } from '@/lib/db/orders';
import { blockCommittedCommercialWrite } from '@/lib/services/order-change/order-change-legacy-writer-guard';
import type { OrderItem, Order } from '@/types/order';

interface AddOrderItemsResult {
  success: boolean;
  data?: {
    items: OrderItem[];
    order: Order;
  };
  error?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

/**
 * Add items to an order
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param orderId - Order ID
 * @param data - Items to add
 * @returns Result with created items and updated order
 */
export async function addOrderItems(
  tenantOrgId: string,
  orderId: string,
  data: unknown
): Promise<AddOrderItemsResult> {
  const guard = await resolveActionTenant({
    action: 'orders.addOrderItems',
    expectedTenantId: tenantOrgId,
    permission: ORDERS_PERMISSIONS.UPDATE,
  });
  if (!guard.ok || !guard.tenantId) {
    return { success: false, error: guard.error, errorCode: guard.error };
  }
  const tenantId = guard.tenantId;

  try {
    // Validate input
    const validation = addOrderItemsSchema.safeParse(data);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      });

      return {
        success: false,
        error: 'Validation failed - Add Order Items',
        errors,
      };
    }

    const retiredWrite = await blockCommittedCommercialWrite(tenantId, orderId);
    if (retiredWrite) return retiredWrite.body;

    const result = await addOrderItemsDb(tenantId, orderId, validation.data);

    // Revalidate order pages
    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath(`/dashboard/orders/${orderId}/prepare`);
    revalidatePath('/dashboard/orders');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[addOrderItems] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add items to order',
    };
  }
}
