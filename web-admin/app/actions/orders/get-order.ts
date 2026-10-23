/**
 * Server Action: Get Order
 *
 * Fetches a single order with full details including customer, items, and branch.
 * Tenant comes from the session; a caller-supplied tenant id is only verified (BF-20).
 */

'use server';

import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { getOrderById, getOrderByReference } from '@/lib/db/orders';
import type { OrderWithDetails } from '@/types/order';

interface GetOrderResult {
  success: boolean;
  data?: OrderWithDetails;
  error?: string;
}

/**
 * Get order by ID.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param orderId - Order ID
 * @returns Order with full details
 */
export async function getOrder(
  tenantOrgId: string,
  orderId: string
): Promise<GetOrderResult> {
  const guard = await resolveActionTenant({
    action: 'orders.getOrder',
    expectedTenantId: tenantOrgId,
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };

  try {
    const order = await getOrderById(guard.tenantId, orderId);

    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error('[getOrder] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order',
    };
  }
}

/**
 * Get order by ID or order number.
 *
 * This keeps caller screens flexible when only `order_no` is available while
 * still resolving inside the authenticated tenant boundary.
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param orderReference - Order ID or order number
 * @returns Order with full details
 */
export async function getOrderByRef(
  tenantOrgId: string,
  orderReference: string
): Promise<GetOrderResult> {
  const guard = await resolveActionTenant({
    action: 'orders.getOrderByRef',
    expectedTenantId: tenantOrgId,
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };

  try {
    const order = await getOrderByReference(guard.tenantId, orderReference);

    if (!order) {
      return {
        success: false,
        error: 'Order not found',
      };
    }

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error('[getOrderByRef] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order',
    };
  }
}
