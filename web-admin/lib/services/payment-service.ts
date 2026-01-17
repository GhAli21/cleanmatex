/**
 * Payment Service for CleanMateX
 *
 * Handles all payment-related operations including:
 * - Payment processing
 * - Payment validation
 * - Payment transaction recording
 * - Payment status tracking
 * - Payment method management
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext, getTenantIdFromSession } from '../db/tenant-context';
import type {
  PaymentMethod,
  PaymentMethodCode,
  PaymentTransaction,
  PaymentStatus,
  ProcessPaymentInput,
  ProcessPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  CreatePaymentTransactionInput,
  PaymentValidation,
  PaymentValidationError,
} from '../types/payment';

// ============================================================================
// Payment Method Management
// ============================================================================

/**
 * Get all available payment methods for a tenant
 */
export async function getAvailablePaymentMethods(): Promise<PaymentMethod[]> {
  const methods = await prisma.sys_payment_method_cd.findMany({
    where: {
      is_enabled: true,
      is_active: true,
    },
    orderBy: {
      payment_method_code: 'asc',
    },
  });

  return methods.map((method) => ({
    payment_method_code: method.payment_method_code as PaymentMethodCode,
    payment_method_name: method.payment_method_name,
    payment_method_name2: method.payment_method_name2 ?? undefined,
    is_enabled: method.is_enabled,
    is_active: method.is_active,
    payment_type_icon: method.payment_type_icon ?? undefined,
    payment_type_color1: method.payment_type_color1 ?? undefined,
    payment_type_color2: method.payment_type_color2 ?? undefined,
    payment_type_color3: method.payment_type_color3 ?? undefined,
    payment_type_image: method.payment_type_image ?? undefined,
    rec_notes: method.rec_notes ?? undefined,
  }));
}

/**
 * Validate if payment method is available and enabled
 */
export async function validatePaymentMethod(
  paymentMethod: PaymentMethodCode
): Promise<{ isValid: boolean; error?: string }> {
  const method = await prisma.sys_payment_method_cd.findUnique({
    where: {
      payment_method_code: paymentMethod,
    },
  });

  if (!method) {
    return {
      isValid: false,
      error: `Payment method ${paymentMethod} not found`,
    };
  }

  if (!method.is_enabled) {
    return {
      isValid: false,
      error: `Payment method ${paymentMethod} is currently disabled`,
    };
  }

  if (!method.is_active) {
    return {
      isValid: false,
      error: `Payment method ${paymentMethod} is no longer active`,
    };
  }

  return { isValid: true };
}

// ============================================================================
// Payment Processing
// ============================================================================

/**
 * Process payment for an order
 * Main payment processing function that handles all payment logic
 */
export async function processPayment(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      invoice_id: input.invoice_id || '',
      payment_status: 'failed',
      amount_paid: 0,
      remaining_balance: input.amount,
      error: 'Unauthorized: Tenant ID required',
      errorCode: 'UNAUTHORIZED',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      // 1. Validate payment method
      const methodValidation = await validatePaymentMethod(input.payment_method);
      if (!methodValidation.isValid) {
        return {
          success: false,
          invoice_id: input.invoice_id || '',
          payment_status: 'failed',
          amount_paid: 0,
          remaining_balance: input.amount,
          error: methodValidation.error,
          errorCode: 'INVALID_PAYMENT_METHOD',
        };
      }

      // 2. Get or create invoice
      let invoiceId = input.invoice_id;
      if (!invoiceId) {
        const invoice = await createInvoiceForOrder(input.order_id, input.amount);
        if (!invoice) {
          return {
            success: false,
            invoice_id: '',
            payment_status: 'failed',
            amount_paid: 0,
            remaining_balance: input.amount,
            error: 'Failed to create invoice',
            errorCode: 'INVOICE_CREATION_FAILED',
          };
        }
        invoiceId = invoice.id;
      }

      // 3. Validate payment amount - middleware adds tenant_org_id automatically
      const invoice = await prisma.org_invoice_mst.findUnique({
        where: { id: invoiceId },
      });

    if (!invoice) {
      return {
        success: false,
        invoice_id: invoiceId,
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: input.amount,
        error: 'Invoice not found',
        errorCode: 'INVOICE_NOT_FOUND',
      };
    }

    const remainingBalance = Number(invoice.total) - Number(invoice.paid_amount);
    if (input.amount > remainingBalance) {
      return {
        success: false,
        invoice_id: invoiceId,
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: remainingBalance,
        error: 'Payment amount exceeds remaining balance',
        errorCode: 'AMOUNT_EXCEEDS_BALANCE',
      };
    }

    // 4. Process payment based on method
    const paymentResult = await processPaymentByMethod(input);
    if (!paymentResult.success) {
      return paymentResult;
    }

    // 5. Record payment transaction
    const transaction = await recordPaymentTransaction({
      invoice_id: invoiceId,
      paid_amount: input.amount,
      payment_method: input.payment_method,
      paid_by: input.processed_by,
      metadata: {
        check_number: input.check_number,
        gateway_token: input.gateway_token,
        promo_code: input.promo_code,
        gift_card_number: input.gift_card_number,
        gift_card_amount: input.gift_card_amount,
      },
      rec_notes: input.notes,
    });

      // 6. Update invoice - middleware adds tenant_org_id automatically
      const updatedPaidAmount = Number(invoice.paid_amount) + input.amount;
      const newStatus =
        updatedPaidAmount >= Number(invoice.total) ? 'paid' : 'partial';

      await prisma.org_invoice_mst.update({
        where: { id: invoiceId },
        data: {
          paid_amount: updatedPaidAmount,
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date() : undefined,
          paid_by: input.processed_by,
          payment_method: input.payment_method,
          updated_at: new Date(),
          updated_by: input.processed_by,
        },
      });

      // 7. Update order payment status
      await updateOrderPaymentStatus(input.order_id, newStatus, updatedPaidAmount);

      return {
        success: true,
        invoice_id: invoiceId,
        transaction_id: transaction.id,
        payment_status: newStatus === 'paid' ? 'completed' : 'completed',
        amount_paid: input.amount,
        remaining_balance: Number(invoice.total) - updatedPaidAmount,
        metadata: {
          transaction_id: transaction.id,
          payment_method: input.payment_method,
        },
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        invoice_id: input.invoice_id || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: input.amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'PROCESSING_ERROR',
      };
    }
  });
}

/**
 * Process payment based on specific payment method
 */
async function processPaymentByMethod(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  switch (input.payment_method) {
    case 'CASH':
    case 'CHECK':
    case 'PAY_ON_COLLECTION':
    case 'INVOICE':
      // These methods don't require gateway processing
      return {
        success: true,
        invoice_id: input.invoice_id || '',
        payment_status: 'completed',
        amount_paid: input.amount,
        remaining_balance: 0,
      };

    case 'CARD':
    case 'HYPERPAY':
    case 'PAYTABS':
    case 'STRIPE':
      // TODO: Implement gateway processing in Phase 2
      // For now, mark as pending
      return {
        success: true,
        invoice_id: input.invoice_id || '',
        payment_status: 'pending',
        amount_paid: input.amount,
        remaining_balance: 0,
        metadata: {
          requires_gateway_processing: true,
          gateway: input.payment_method.toLowerCase(),
        },
      };

    default:
      return {
        success: false,
        invoice_id: input.invoice_id || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: input.amount,
        error: `Unsupported payment method: ${input.payment_method}`,
        errorCode: 'UNSUPPORTED_METHOD',
      };
  }
}

/**
 * Record a payment transaction
 */
export async function recordPaymentTransaction(
  input: CreatePaymentTransactionInput
): Promise<PaymentTransaction> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
      const transaction = await prisma.org_payments_dtl_tr.create({
        data: {
          invoice_id: input.invoice_id,
          paid_amount: input.paid_amount,
          payment_method: input.payment_method,
          paid_at: new Date(),
          paid_by: input.paid_by,
          status: 'completed',
          gateway: input.gateway ?? undefined,
          transaction_id: input.transaction_id ?? undefined,
          metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
          rec_notes: input.rec_notes,
          created_at: new Date(),
          created_by: input.paid_by,
        },
      });

      return {
        id: transaction.id,
        invoice_id: transaction.invoice_id,
        tenant_org_id: transaction.tenant_org_id,
        paid_amount: Number(transaction.paid_amount),
        status: transaction.status as PaymentStatus,
        payment_method: transaction.payment_method as PaymentMethodCode | undefined,
        paid_at: transaction.paid_at?.toISOString(),
        paid_by: transaction.paid_by ?? undefined,
        gateway: transaction.gateway ?? undefined,
        transaction_id: transaction.transaction_id ?? undefined,
        metadata: transaction.metadata
          ? JSON.parse(transaction.metadata as string)
          : undefined,
        rec_notes: transaction.rec_notes ?? undefined,
        created_at: transaction.created_at.toISOString(),
        created_by: transaction.created_by ?? undefined,
      };
    });
  }

/**
 * Get payment history for an invoice
 */
export async function getPaymentHistory(
  invoiceId: string
): Promise<PaymentTransaction[]> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_payments_dtl_tr.findMany({
      where: {
        invoice_id: invoiceId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      invoice_id: transaction.invoice_id,
      tenant_org_id: transaction.tenant_org_id,
      paid_amount: Number(transaction.paid_amount),
      status: transaction.status as PaymentStatus,
      payment_method: transaction.payment_method as PaymentMethodCode | undefined,
      paid_at: transaction.paid_at?.toISOString(),
      paid_by: transaction.paid_by ?? undefined,
      gateway: transaction.gateway ?? undefined,
      transaction_id: transaction.transaction_id ?? undefined,
      metadata: transaction.metadata
        ? JSON.parse(transaction.metadata as string)
        : undefined,
      rec_notes: transaction.rec_notes ?? undefined,
      created_at: transaction.created_at.toISOString(),
      created_by: transaction.created_by ?? undefined,
      updated_at: transaction.updated_at?.toISOString(),
      updated_by: transaction.updated_by ?? undefined,
    }));
  });
}

// ============================================================================
// Payment Validation
// ============================================================================

/**
 * Validate payment data before processing
 */
export async function validatePaymentData(
  input: ProcessPaymentInput
): Promise<PaymentValidation> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      isValid: false,
      errors: [
        {
          field: 'tenant',
          message: 'Unauthorized: Tenant ID required',
          code: 'UNAUTHORIZED',
        },
      ],
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const errors: PaymentValidationError[] = [];

    // Validate amount
    if (input.amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Payment amount must be greater than zero',
        code: 'INVALID_AMOUNT',
      });
    }

    // Validate payment method
    const methodValidation = await validatePaymentMethod(input.payment_method);
    if (!methodValidation.isValid) {
      errors.push({
        field: 'payment_method',
        message: methodValidation.error || 'Invalid payment method',
        code: 'INVALID_METHOD',
      });
    }

    // Validate check number if payment method is CHECK
    if (input.payment_method === 'CHECK' && !input.check_number) {
      errors.push({
        field: 'check_number',
        message: 'Check number is required for check payments',
        code: 'CHECK_NUMBER_REQUIRED',
      });
    }

    // Validate order exists - middleware adds tenant_org_id automatically
    const order = await prisma.org_orders_mst.findUnique({
      where: { id: input.order_id },
    });

    if (!order) {
      errors.push({
        field: 'order_id',
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  });
}

// ============================================================================
// Payment Status Management
// ============================================================================

/**
 * Update order payment status
 * Note: This function is called within tenant context, so middleware applies automatically
 */
async function updateOrderPaymentStatus(
  orderId: string,
  status: string,
  paidAmount: number
): Promise<void> {
  // Middleware adds tenant_org_id automatically since we're within tenant context
  await prisma.org_orders_mst.update({
    where: { id: orderId },
    data: {
      payment_status: status,
      paid_amount: paidAmount,
      paid_at: status === 'paid' ? new Date() : undefined,
      updated_at: new Date(),
    },
  });
}

/**
 * Get payment status for an order
 */
export async function getPaymentStatus(orderId: string): Promise<{
  status: string;
  total: number;
  paid: number;
  remaining: number;
}> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    const order = await prisma.org_orders_mst.findUnique({
      where: { id: orderId },
      include: {
        invoices: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const total = Number(order.total_amount || 0);
    const paid = Number(order.paid_amount || 0);
    const remaining = total - paid;

    return {
      status: order.payment_status || 'pending',
      total,
      paid,
      remaining,
    };
  });
}

// ============================================================================
// Refund Processing
// ============================================================================

/**
 * Process a payment refund
 * TODO: Implement full refund logic in Phase 2
 */
export async function refundPayment(
  input: RefundPaymentInput
): Promise<RefundPaymentResult> {
  // Get tenant ID from session
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      refund_transaction_id: '',
      refund_amount: 0,
      error: 'Unauthorized: Tenant ID required',
    };
  }

  // Wrap with tenant context - middleware automatically adds tenant_org_id
  return withTenantContext(tenantId, async () => {
    try {
      // Get original transaction - middleware adds tenant_org_id automatically
      const transaction = await prisma.org_payments_dtl_tr.findUnique({
        where: { id: input.transaction_id },
      });

      if (!transaction) {
        return {
          success: false,
          refund_transaction_id: '',
          refund_amount: 0,
          error: 'Transaction not found',
        };
      }

      // Validate refund amount
      const originalAmount = Number(transaction.paid_amount);
      if (input.amount > originalAmount) {
        return {
          success: false,
          refund_transaction_id: '',
          refund_amount: 0,
          error: 'Refund amount exceeds original payment',
        };
      }

      // Create refund transaction - middleware adds tenant_org_id automatically
      const refundTransaction = await prisma.org_payments_dtl_tr.create({
        data: {
          invoice_id: transaction.invoice_id,
          paid_amount: -input.amount, // Negative for refund
          payment_method: transaction.payment_method,
          paid_at: new Date(),
          paid_by: input.processed_by,
          status: 'refunded',
          gateway: transaction.gateway,
          metadata: JSON.stringify({
            original_transaction_id: input.transaction_id,
            refund_reason: input.reason,
          }),
          rec_notes: `Refund: ${input.reason}`,
          created_at: new Date(),
          created_by: input.processed_by,
        },
      });

      // Update invoice - middleware adds tenant_org_id automatically
      const invoice = await prisma.org_invoice_mst.findUnique({
        where: { id: transaction.invoice_id },
      });

      if (invoice) {
        const newPaidAmount = Number(invoice.paid_amount) - input.amount;
        await prisma.org_invoice_mst.update({
          where: { id: invoice.id },
          data: {
            paid_amount: newPaidAmount,
            status: newPaidAmount >= Number(invoice.total) ? 'paid' : 'partial',
            updated_at: new Date(),
            updated_by: input.processed_by,
          },
        });
      }

      return {
        success: true,
        refund_transaction_id: refundTransaction.id,
        refund_amount: input.amount,
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        refund_transaction_id: '',
        refund_amount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an invoice for an order
 */
async function createInvoiceForOrder(
  orderId: string,
  amount: number
): Promise<{ id: string } | null> {
  try {
    const order = await prisma.org_orders_mst.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return null;
    }

    const invoice = await prisma.org_invoice_mst.create({
      data: {
        order_id: orderId,
        tenant_org_id: order.tenant_org_id,
        invoice_no: await generateInvoiceNumber(order.tenant_org_id),
        subtotal: amount,
        discount: 0,
        tax: 0,
        total: amount,
        status: 'pending',
        paid_amount: 0,
        created_at: new Date(),
      },
    });

    return { id: invoice.id };
  } catch (error) {
    console.error('Error creating invoice:', error);
    return null;
  }
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber(tenantOrgId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of invoices this month
  const count = await prisma.org_invoice_mst.count({
    where: {
      tenant_org_id: tenantOrgId,
      invoice_no: {
        startsWith: `INV-${year}${month}`,
      },
    },
  });

  return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
}

/**
 * Format amount to OMR currency
 */
export function formatOMR(amount: number): string {
  return `OMR ${amount.toFixed(3)}`;
}
