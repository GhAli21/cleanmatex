/**
 * Server Action: order invoices (compatibility read).
 *
 * @deprecated New AR invoice UI and APIs should use the canonical `/api/v1/ar/*`
 * surface and `ar-invoice.service.ts`. Only the order-screen read below remains.
 *
 * BF-20 (2026-10-23): the unused legacy actions `createInvoiceAction`,
 * `getInvoiceAction`, `updateInvoiceAction`, `markAsPaidAction`,
 * `applyDiscountAction` and `getInvoiceStatsAction` were removed. A
 * `'use server'` export is a callable endpoint even with no caller, and these
 * had no permission checks (any tenant user could mark an invoice paid).
 */

'use server';

import { resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { getInvoicesForOrder } from '@/lib/services/invoice-service';

/**
 * Get all invoices for an order of the session tenant.
 *
 * @param orderId - Order ID
 * @returns Array of invoices
 * @deprecated Order screens still rely on this compatibility action.
 */
export async function getOrderInvoices(orderId: string) {
  const guard = await resolveActionTenant({
    action: 'invoices.getOrderInvoices',
    permission: ORDERS_PERMISSIONS.READ,
  });
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const invoices = await getInvoicesForOrder(orderId);

    return {
      success: true,
      data: invoices,
    };
  } catch (error) {
    console.error('Error fetching order invoices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch invoices',
    };
  }
}
