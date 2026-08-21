/**
 * Server Action: Get Order
 *
 * Fetches a single order with full details including customer, items, and branch.
 */

'use server';

import {
  getOrderById,
  getOrderByReference,
  getOrderForPreparation,
} from '@/lib/db/orders';
import type { OrderWithDetails } from '@/types/order';

interface GetOrderResult {
  success: boolean;
  data?: OrderWithDetails;
  error?: string;
}

interface GetOrderForPreparationResult {
  success: boolean;
  data?: {
    order: OrderWithDetails;
    productCatalog: any[];
  };
  error?: string;
}

/**
 * Get order by ID
 *
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param orderId - Order ID
 * @returns Order with full details
 */
export async function getOrder(
  tenantOrgId: string,
  orderId: string
): Promise<GetOrderResult> {
  try {
    const order = await getOrderById(tenantOrgId, orderId);

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
 */
export async function getOrderByRef(
  tenantOrgId: string,
  orderReference: string
): Promise<GetOrderResult> {
  try {
    const order = await getOrderByReference(tenantOrgId, orderReference);

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

/**
 * Get order for preparation (includes product catalog)
 *
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param orderId - Order ID
 * @returns Order with product catalog
 */
export async function getOrderForPrep(
  tenantOrgId: string,
  orderId: string
): Promise<GetOrderForPreparationResult> {
  try {
    const data = await getOrderForPreparation(tenantOrgId, orderId);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[getOrderForPrep] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order for preparation',
    };
  }
}
