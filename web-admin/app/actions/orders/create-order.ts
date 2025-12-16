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
 * @param tenantOrgId - Tenant organization ID (from session)
 * @param formData - Form data or input object
 * @returns Result with created order or error
 */
export async function createOrder(
  tenantOrgId: string,
  formData: FormData | Record<string, any>
): Promise<CreateOrderResult> {
  try {
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

    // Create order in database
    const order = await createOrderDb(tenantOrgId, validation.data);

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
