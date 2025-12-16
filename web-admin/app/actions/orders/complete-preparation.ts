/**
 * Server Action: Complete Preparation
 *
 * Marks order preparation as complete and calculates Ready-By date.
 * Transitions order status from 'intake' to 'processing'.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { completePreparationSchema } from '@/lib/validations/order-schema';
import { completePreparation as completePreparationDb } from '@/lib/db/orders';
import type { Order } from '@/types/order';

interface CompletePreparationResult {
  success: boolean;
  data?: Order;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Complete order preparation
 *
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param orderId - Order ID
 * @param userId - User ID completing preparation (from session)
 * @param data - Preparation completion data
 * @returns Result with updated order
 */
export async function completePreparation(
  tenantOrgId: string,
  orderId: string,
  userId: string,
  data: unknown
): Promise<CompletePreparationResult> {
  try {
    // Validate input
    const validation = completePreparationSchema.safeParse(data);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      });

      return {
        success: false,
        error: 'Validation failed - Complete Preparation',
        errors,
      };
    }

    // Complete preparation
    const order = await completePreparationDb(tenantOrgId, orderId, userId, validation.data);

    // Revalidate order pages
    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath(`/dashboard/orders/${orderId}/prepare`);
    revalidatePath('/dashboard/orders');

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error('[completePreparation] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete preparation',
    };
  }
}
