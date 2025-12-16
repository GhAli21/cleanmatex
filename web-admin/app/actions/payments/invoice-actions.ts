/**
 * Server Action: Invoice Management
 *
 * Actions for creating, retrieving, and managing invoices.
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  createInvoice,
  getInvoice,
  getInvoicesForOrder,
  updateInvoice,
  markInvoiceAsPaid,
  getInvoiceStats,
  applyDiscountToInvoice,
} from '@/lib/services/invoice-service';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  Invoice,
} from '@/lib/types/payment';

/**
 * Create a new invoice for an order
 *
 * @param tenantOrgId - Tenant organization ID
 * @param input - Invoice creation input
 * @returns Created invoice or error
 */
export async function createInvoiceAction(
  tenantOrgId: string,
  input: CreateInvoiceInput
) {
  try {
    const invoice = await createInvoice(input);

    // Revalidate order pages
    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${input.order_id}`);

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    };
  }
}

/**
 * Get invoice by ID
 *
 * @param invoiceId - Invoice ID
 * @returns Invoice data or null
 */
export async function getInvoiceAction(invoiceId: string) {
  try {
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return {
        success: false,
        error: 'Invoice not found',
      };
    }

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch invoice',
    };
  }
}

/**
 * Get all invoices for an order
 *
 * @param orderId - Order ID
 * @returns Array of invoices
 */
export async function getOrderInvoices(orderId: string) {
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

/**
 * Update invoice
 *
 * @param invoiceId - Invoice ID
 * @param input - Update data
 * @returns Updated invoice or error
 */
export async function updateInvoiceAction(
  invoiceId: string,
  input: UpdateInvoiceInput
) {
  try {
    const invoice = await updateInvoice(invoiceId, input);

    // Revalidate invoice pages
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${invoiceId}`);

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    console.error('Error updating invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update invoice',
    };
  }
}

/**
 * Mark invoice as paid
 *
 * @param invoiceId - Invoice ID
 * @param paidAmount - Amount paid
 * @param paidBy - User ID who recorded payment
 * @returns Updated invoice or error
 */
export async function markAsPaidAction(
  invoiceId: string,
  paidAmount: number,
  paidBy: string
) {
  try {
    const invoice = await markInvoiceAsPaid(invoiceId, paidAmount, paidBy);

    // Revalidate invoice pages
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${invoiceId}`);

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
    };
  }
}

/**
 * Apply discount to invoice
 *
 * @param invoiceId - Invoice ID
 * @param discountAmount - Discount amount
 * @param reason - Reason for discount
 * @returns Updated invoice or error
 */
export async function applyDiscountAction(
  invoiceId: string,
  discountAmount: number,
  reason?: string
) {
  try {
    const invoice = await applyDiscountToInvoice(
      invoiceId,
      discountAmount,
      reason
    );

    // Revalidate invoice pages
    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${invoiceId}`);

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    console.error('Error applying discount to invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply discount',
    };
  }
}

/**
 * Get invoice statistics for tenant
 *
 * @param tenantOrgId - Tenant organization ID
 * @returns Invoice statistics
 */
export async function getInvoiceStatsAction(tenantOrgId: string) {
  try {
    const stats = await getInvoiceStats(tenantOrgId);

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch invoice stats',
    };
  }
}
