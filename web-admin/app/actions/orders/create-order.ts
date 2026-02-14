/**
 * Server Action: Create Order
 *
 * Creates a new Quick Drop order with automatic order number generation,
 * QR code, and barcode.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createOrderSchema } from '@/lib/validations/order-schema';
import { createOrder as createOrderDb } from '@/lib/db/orders';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/types/order';

interface CreateOrderResult {
  success: boolean;
  data?: Order;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Create a new Quick Drop order
 *
 * Tenant ID is resolved from session server-side. Client must be authenticated
 * with tenant_org_id in user metadata.
 *
 * @param formData - Form data or input object
 * @returns Result with created order or error
 */
export async function createOrder(
  formData: FormData | Record<string, any>
): Promise<CreateOrderResult> {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant ID is required. User must be authenticated and have tenant_org_id in metadata.',
      };
    }

    // Parse form data
    const rawData =
      formData instanceof FormData
        ? {
            customerId: formData.get('customerId'),
            branchId: formData.get('branchId') || undefined,
            orderType: formData.get('orderType') || 'quick_drop',
            serviceCategory: formData.get('serviceCategory'),
            bagCount: parseInt(formData.get('bagCount') as string, 10),
            priority: formData.get('priority') || 'normal',
            customerNotes: formData.get('customerNotes') || undefined,
            internalNotes: formData.get('internalNotes') || undefined,
            photoUrls: formData.getAll('photoUrls[]').filter(Boolean),
          }
        : formData;

    // Validate input
    const validation = createOrderSchema.safeParse(rawData);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      });

      return {
        success: false,
        error: 'Validation failed-Create Order',
        errors,
      };
    }

    // Get user ID for created_by audit
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = user?.id;

    // Create order in database
    const order = await createOrderDb(tenantId, { ...validation.data, createdBy });

    // Revalidate orders list
    revalidatePath('/dashboard/orders');

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error('[createOrder] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}
