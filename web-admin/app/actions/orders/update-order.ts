/**
 * Server Action: Update Order
 *
 * PRD: Edit Order Feature - Server Action
 * Updates an existing order with validation, locking, and audit trail
 */

'use server';

import { revalidatePath } from 'next/cache';
import { OrderService } from '@/lib/services/order-service';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { updateOrderInputSchema } from '@/lib/validations/edit-order-schemas';
import { logger } from '@/lib/utils/logger';

interface UpdateOrderResult {
  success: boolean;
  data?: any;
  error?: string;
  errors?: Array<{ path: string[]; message: string }>;
}

/**
 * Update an existing order
 *
 * Tenant ID is resolved from session server-side. Client must be authenticated
 * with tenant_org_id in user metadata.
 *
 * @param input - Order update data
 * @returns Result with updated order or error
 */
export async function updateOrderAction(input: unknown): Promise<UpdateOrderResult> {
  try {
    // 1. Get tenant ID from session
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant ID required. User must be authenticated.',
      };
    }

    // 2. Get user info
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // 3. Validate input
    const parsed = updateOrderInputSchema.safeParse(input);
    if (!parsed.success) {
      logger.warn('[updateOrderAction] Validation failed', {
        feature: 'orders',
        action: 'update_order_action',
        userId: user.id,
        zodIssues: parsed.error.issues,
      });

      return {
        success: false,
        error: 'Validation failed',
        errors: parsed.error.issues.map(issue => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
      };
    }

    // 4. Call updateOrder service
    const result = await OrderService.updateOrder({
      ...parsed.data,
      tenantId,
      userId: user.id,
      userName: user.email || user.user_metadata?.name || 'Unknown',
    });

    if (!result.success) {
      logger.warn('[updateOrderAction] Update failed', {
        feature: 'orders',
        action: 'update_order_action',
        orderId: parsed.data.orderId,
        userId: user.id,
        error: result.error,
      });

      return {
        success: false,
        error: result.error,
      };
    }

    // 5. Revalidate paths
    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);

    logger.info('[updateOrderAction] Order updated successfully', {
      feature: 'orders',
      action: 'update_order_action',
      orderId: parsed.data.orderId,
      userId: user.id,
    });

    return {
      success: true,
      data: result.order,
    };
  } catch (error) {
    logger.error('[updateOrderAction] Unexpected error', error as Error, {
      feature: 'orders',
      action: 'update_order_action',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order',
    };
  }
}
