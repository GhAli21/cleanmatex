/**
 * Server Action: List Orders
 *
 * Fetches paginated list of orders with filters and search.
 * Automatically uses tenant context from session.
 */

'use server';

import { listOrders as listOrdersDb, getOrderStats } from '@/lib/db/orders';
import { orderFiltersSchema } from '@/lib/validations/order-schema';
import { withTenantContext, getTenantIdFromSession } from '@/lib/db/tenant-context';
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
 * @param tenantOrgId - Tenant organization ID (from session) - kept for backward compatibility
 * @param filters - Filter criteria
 * @returns Paginated list of orders
 */
export async function listOrders(
  tenantOrgId: string,
  filters: unknown
): Promise<ListOrdersResult> {
  try {
    // Validate filters
    const validation = orderFiltersSchema.safeParse(filters);

    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid filter parameters',
      };
    }

    // Use tenant context - all Prisma queries will automatically filter by tenant_org_id
    const result = await withTenantContext(tenantOrgId, async () => {
      return await listOrdersDb(tenantOrgId, validation.data);
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
 * @param tenantOrgId - Tenant organization ID (from session) - kept for backward compatibility
 * @returns Order statistics
 */
export async function getStats(
  tenantOrgId: string
): Promise<GetOrderStatsResult> {
  try {
    // Use tenant context - all Prisma queries will automatically filter by tenant_org_id
    const stats = await withTenantContext(tenantOrgId, async () => {
      return await getOrderStats(tenantOrgId);
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
