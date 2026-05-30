/**
 * Server Action: Invoice Management
 *
 * Actions for creating, retrieving, and managing invoices.
 *
 * @deprecated New AR invoice UI and APIs should use the canonical `/api/v1/ar/*`
 * surface and `ar-invoice.service.ts`. These actions stay only for route
 * compatibility while older order screens are still being bridged.
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  getInvoice,
  getInvoicesForOrder,
  updateInvoice,
  markInvoiceAsPaid,
  getInvoiceStats,
  applyDiscountToInvoice,
} from '@/lib/services/invoice-service';
import { createArInvoiceFromOrders } from '@/lib/services/ar-invoice.service';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from '@/lib/types/payment';
import { createInvoiceInputSchema } from '@/lib/validations/new-order-payment-schemas';

/**
 * Create an AR invoice for an order via the canonical writer.
 *
 * BVM Wiring Phase 6 Sub-item 2: the previous body called the now-removed
 * `createInvoice` legacy adapter in `invoice-service.ts`. This action is a
 * thin shim around `createArInvoiceFromOrders` so the few remaining order
 * screens that still rely on the action keep working while we migrate them
 * to call the canonical writer directly.
 *
 * `issueImmediately: true` preserves the legacy behaviour of creating an
 * OPEN invoice with an AR ledger debit + `AR_INVOICE_ISSUED` outbox event.
 * The idempotency key mirrors the order-id-scoped shape used by submit-order
 * so a replay produces the same invoice instead of a duplicate.
 *
 * @param tenantOrgId Tenant organization ID (forwarded to the writer's
 *                    actor context — auth fallback still applies).
 * @param input       Legacy invoice creation payload. Only `order_id`,
 *                    `due_date`, `metadata.created_by`, and `rec_notes`
 *                    are forwarded; the canonical writer derives the
 *                    rest (totals, currency, customer) from the order
 *                    snapshot at write time.
 * @returns Result envelope with the created AR-invoice id.
 *
 * @deprecated New screens should call `/api/v1/ar/invoices/from-orders`
 *             (canonical AR route) directly. This shim exists only to
 *             keep the legacy action callable until those screens are
 *             migrated.
 */
export async function createInvoiceAction(
  tenantOrgId: string,
  input: CreateInvoiceInput,
) {
  const parsed = createInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid invoice input',
    };
  }

  try {
    // Today's date as the invoice_date / due_date floor. The legacy
    // adapter accepted `due_date` from the caller and defaulted to the
    // invoice_date when absent — preserved here.
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = parsed.data.due_date
      ? parsed.data.due_date.slice(0, 10)
      : today;

    const detail = await createArInvoiceFromOrders(
      {
        order_ids: [parsed.data.order_id],
        invoice_date: today,
        due_date: dueDate,
        allocation_policy: 'REMAINING_ONLY',
        rec_notes: parsed.data.rec_notes,
        // Stable key — replays of the same action against the same order
        // collapse onto the same AR invoice instead of producing a copy.
        idempotency_key: `legacy_action_${parsed.data.order_id}`,
        // Mirror the legacy adapter: OPEN at creation, AR ledger debit
        // and AR_INVOICE_ISSUED outbox event emitted in the same tx.
        issueImmediately: true,
      },
      { tenantId: tenantOrgId, userId: input.metadata?.created_by ?? undefined },
    );

    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${input.order_id}`);

    return {
      success: true,
      data: detail,
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
 * @deprecated Prefer canonical AR invoice detail APIs for new work.
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
 * @deprecated Order screens still rely on this compatibility action.
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
 * @deprecated Prefer canonical AR invoice update APIs for new work.
 */
export async function updateInvoiceAction(
  invoiceId: string,
  input: UpdateInvoiceInput
) {
  try {
    const invoice = await updateInvoice(invoiceId, input);

    // Revalidate invoice pages
    revalidatePath('/dashboard/internal_fin/invoices');
    revalidatePath(`/dashboard/internal_fin/invoices/${invoiceId}`);

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
 * @deprecated Prefer canonical AR allocation flows for new work.
 */
export async function markAsPaidAction(
  invoiceId: string,
  paidAmount: number,
  paidBy: string
) {
  try {
    const invoice = await markInvoiceAsPaid(invoiceId, paidAmount, paidBy);

    // Revalidate invoice pages
    revalidatePath('/dashboard/internal_fin/invoices');
    revalidatePath(`/dashboard/internal_fin/invoices/${invoiceId}`);

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
 * @deprecated Prefer canonical AR adjustment flows for new work.
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
    revalidatePath('/dashboard/internal_fin/invoices');
    revalidatePath(`/dashboard/internal_fin/invoices/${invoiceId}`);

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
 * @deprecated Prefer canonical AR hub stats for new work.
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
