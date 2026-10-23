/**
 * Server Action: List Orders
 *
 * Fetches paginated list of orders with filters and search.
 * Tenant comes from the session; a caller-supplied tenant id is only verified (BF-20).
 */

'use server';

import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { listOrders as listOrdersDb, getOrderStats } from '@/lib/db/orders';
import { orderFiltersSchema } from '@/lib/validations/order-schema';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { OrderListResponse, OrderStats } from '@/types/order';

interface ListOrdersResult {
  success: boolean;
  data?: OrderListResponse;
  error?: string;
}

interface GetOrderStatsResult {
  success: boolean;
  data?: OrderStats;
  error?: string;
}

/**
 * List orders with filters and pagination
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @param filters - Filter criteria
 * @returns Paginated list of orders
 */
export async function listOrders(
  tenantOrgId: string,
  filters: unknown
): Promise<ListOrdersResult> {
  const guard = await resolveActionTenant({
    action: 'orders.listOrders',
    expectedTenantId: tenantOrgId,
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };
  const tenantId = guard.tenantId;

  try {
    // Validate filters
    const validation = await orderFiltersSchema.safeParseAsync(filters);

    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid filter parameters',
      };
    }

    const result = await withTenantContext(tenantId, async () => {
      return await listOrdersDb(tenantId, validation.data);
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[listOrders] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
}

/**
 * Get order statistics for dashboard
 *
 * @param tenantOrgId - Tenant the caller expects; must equal the session tenant
 * @returns Order statistics
 */
export async function getStats(
  tenantOrgId: string
): Promise<GetOrderStatsResult> {
  const guard = await resolveActionTenant({
    action: 'orders.getStats',
    expectedTenantId: tenantOrgId,
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok || !guard.tenantId) return { success: false, error: guard.error };
  const tenantId = guard.tenantId;

  try {
    const stats = await withTenantContext(tenantId, async () => {
      return await getOrderStats(tenantId);
    });

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('[getStats] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics',
    };
  }
}
