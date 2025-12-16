/**
 * Server Action: Add Order Items
 *
 * Adds items to an order during the preparation workflow.
 * Automatically calculates pricing, tax, and updates order totals.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { addOrderItemsSchema } from '@/lib/validations/order-schema';
import { addOrderItems as addOrderItemsDb } from '@/lib/db/orders';
import type { OrderItem, Order } from '@/types/order';

interface AddOrderItemsResult {
  success: boolean;
  data?: {
    items: OrderItem[];
    order: Order;
  };
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Add items to an order
 *
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param orderId - Order ID
 * @param data - Items to add
 * @returns Result with created items and updated order
 */
export async function addOrderItems(
  tenantOrgId: string,
  orderId: string,
  data: unknown
): Promise<AddOrderItemsResult> {
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

    // Add items to order
    const result = await addOrderItemsDb(tenantOrgId, orderId, validation.data);

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
