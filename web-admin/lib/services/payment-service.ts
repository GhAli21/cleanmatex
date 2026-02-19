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

/** Transaction client for use inside prisma.$transaction */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
import { tenantSettingsService } from './tenant-settings.service';
import { recordPaymentAudit, paymentSnapshot } from './payment-audit.service';
import { createReceiptVoucherForPayment } from './voucher-service';
import type {
  PaymentMethod,
  PaymentMethodCode,
  PaymentType,
  PaymentTransaction,
  PaymentStatus,
  ProcessPaymentInput,
  ProcessPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  CreatePaymentTransactionInput,
  PaymentValidation,
  PaymentValidationError,
  PaymentKind,
  PaymentListItem,
  PaymentListFilters,
  PaymentStats,
  PaymentListResult,
} from '../types/payment';
import { getTranslations } from 'next-intl/server';

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
    payment_method_icon: method.payment_method_icon ?? undefined,
    payment_method_color1: method.payment_method_color1 ?? undefined,
    payment_method_color2: method.payment_method_color2 ?? undefined,
    payment_method_color3: method.payment_method_color3 ?? undefined,
    payment_method_image: method.payment_method_image ?? undefined,
    rec_notes: method.rec_notes ?? undefined,
  }));
}

/**
 * Get all available payment types (sys_payment_type_cd) for dropdowns
 */
export async function getAvailablePaymentTypes(): Promise<PaymentType[]> {
  const types = await prisma.sys_payment_type_cd.findMany({
    where: {
      is_enabled: true,
      is_active: true,
    },
    orderBy: {
      payment_type_code: 'asc',
    },
  });

  return types.map((t) => ({
    payment_type_code: t.payment_type_code,
    payment_type_name: t.payment_type_name ?? '',
    payment_type_name2: t.payment_type_name2 ?? undefined,
    is_enabled: t.is_enabled,
    has_plan: t.has_plan,
    is_active: t.is_active,
    payment_type_icon: t.payment_type_icon ?? undefined,
    payment_type_color1: t.payment_type_color1 ?? undefined,
    rec_notes: t.rec_notes ?? undefined,
  }));
}

/**
 * Validate if payment method is available and enabled
 */
export async function validatePaymentMethod(
  paymentMethod: PaymentMethodCode
): Promise<{ isValid: boolean; error?: string }> {
  if (paymentMethod == null || paymentMethod === '') {
    return {
      isValid: false,
      error: 'Payment method is required',
    };
  }
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

  return withTenantContext(tenantId, async () => {
    try {
      const methodValidation = await validatePaymentMethod(input.payment_method_code);
      if (!methodValidation.isValid) {
        return failResult(input, 0, methodValidation.error, 'INVALID_PAYMENT_METHOD');
      }

      const kind = input.payment_kind ?? 'invoice';
      const isNonInvoice =
        (kind === 'deposit' || kind === 'advance' || kind === 'pos') && !input.invoice_id;

      if (isNonInvoice) {
        if (kind === 'advance' && !input.customer_id) {
          return failResult(input, 0, 'Customer required for advance payment', 'CUSTOMER_REQUIRED');
        }
        if ((kind === 'deposit' || kind === 'pos') && !input.order_id) {
          return failResult(input, 0, 'Order required for deposit or POS payment', 'ORDER_REQUIRED');
        }
        const transaction = await recordPaymentTransaction({
          order_id: input.order_id,
          customer_id: input.customer_id,
          paid_amount: input.final_total ?? input.amount,
          payment_method_code: input.payment_method_code,
          payment_type_code: input.payment_type_code,
          paid_by: input.processed_by,
          branch_id: input.branch_id,
          subtotal: input.subtotal,
          discount_rate: input.discount_rate,
          discount_amount: input.discount_amount,
          manual_discount_amount: input.manual_discount_amount,
          promo_discount_amount: input.promo_discount_amount,
          gift_card_applied_amount: input.gift_card_applied_amount,
          vat_rate: input.vat_rate,
          vat_amount: input.vat_amount,
          tax_amount: input.tax_amount ?? input.tax,
          payment_channel: input.payment_channel ?? 'web_admin',
          currency_code: input.currency_code,
          currency_ex_rate: input.currency_ex_rate,
          check_number: input.check_number,
          check_bank: input.check_bank,
          check_date: input.check_date,
          promo_code_id: input.promo_code_id,
          gift_card_id: input.gift_card_id,
          metadata: {
            check_number: input.check_number,
            gateway_token: input.gateway_token,
            promo_code: input.promo_code,
            gift_card_number: input.gift_card_number,
            gift_card_amount: input.gift_card_amount,
          },
          rec_notes: input.notes,
          trans_desc: input.trans_desc,
          payment_channel: input.payment_channel ?? 'web_admin',
        });
        const amountPaid = input.final_total ?? input.amount;
        if (input.order_id) {
          const order = await prisma.org_orders_mst.findUnique({
            where: { id: input.order_id },
          });
          if (order) {
            const currentPaid = Number(order.paid_amount ?? 0);
            const newPaid = currentPaid + amountPaid;
            const total = Number(order.total ?? 0);
            await updateOrderPaymentStatus(
              input.order_id,
              newPaid >= total ? 'paid' : 'partial',
              newPaid,
              input.processed_by
            );
          }
        }
        return {
          success: true,
          invoice_id: '',
          transaction_id: transaction.id,
          payment_status: 'completed',
          amount_paid: amountPaid,
          remaining_balance: 0,
          payment_kind: kind,
          metadata: {
            transaction_id: transaction.id,
            payment_method: input.payment_method_code,
          },
        };
      }

      let invoiceId = input.invoice_id;
      // Always use the user-entered amount for the payment; final_total is for invoice/order total (breakdown only), not the payment amount
      const amountToPay = input.amount;

      // FIFO: distribute one payment across all order invoices with balance (oldest first)
      if (
        !invoiceId &&
        input.order_id &&
        input.distribute_across_invoices &&
        amountToPay > 0
      ) {
        const orderInvoices = await prisma.org_invoice_mst.findMany({
          where: { order_id: input.order_id, tenant_org_id: tenantId },
          orderBy: { created_at: 'asc' },
        });
        const withBalance = orderInvoices
          .map((inv) => ({
            id: inv.id,
            total: Number(inv.total),
            paid_amount: Number(inv.paid_amount),
            remaining: Math.max(0, Number(inv.total) - Number(inv.paid_amount)),
          }))
          .filter((inv) => inv.remaining > 0);

        if (withBalance.length > 0) {
          const paymentResult = await processPaymentByMethod(input);
          if (!paymentResult.success) return paymentResult;

          let amountLeft = amountToPay;
          let totalApplied = 0;
          let lastInvoiceId: string | null = null;

          for (const inv of withBalance) {
            if (amountLeft <= 0) break;
            const apply = Math.min(inv.remaining, amountLeft);
            if (apply <= 0) continue;

            await recordPaymentTransaction({
              invoice_id: inv.id,
              order_id: input.order_id,
              customer_id: input.customer_id,
              paid_amount: apply,
              payment_method_code: input.payment_method_code,
              payment_type_code: input.payment_type_code,
              paid_by: input.processed_by,
              branch_id: input.branch_id,
              subtotal: input.subtotal,
              discount_rate: input.discount_rate,
              discount_amount: input.discount_amount,
              manual_discount_amount: input.manual_discount_amount,
              promo_discount_amount: input.promo_discount_amount,
              gift_card_applied_amount: input.gift_card_applied_amount,
              vat_rate: input.vat_rate,
              vat_amount: input.vat_amount,
              tax_rate: input.tax_rate,
              tax_amount: input.tax_amount,
              currency_code: input.currency_code,
              currency_ex_rate: input.currency_ex_rate,
              check_number: input.check_number,
              check_bank: input.check_bank,
              check_date: input.check_date,
              promo_code_id: input.promo_code_id,
              gift_card_id: input.gift_card_id,
              metadata: {
                check_number: input.check_number,
                gateway_token: input.gateway_token,
                promo_code: input.promo_code,
                gift_card_number: input.gift_card_number,
                gift_card_amount: input.gift_card_amount,
              },
              rec_notes: input.notes,
              trans_desc: input.trans_desc,
              payment_channel: input.payment_channel ?? 'web_admin',
            });

            const newPaid = inv.paid_amount + apply;
            const newStatus = newPaid >= inv.total ? 'paid' : 'partial';
            await prisma.org_invoice_mst.update({
              where: { id: inv.id },
              data: {
                paid_amount: newPaid,
                status: newStatus,
                paid_at: newStatus === 'paid' ? new Date() : undefined,
                paid_by: input.processed_by,
                updated_at: new Date(),
                updated_by: input.processed_by,
              },
            });

            amountLeft -= apply;
            totalApplied += apply;
            lastInvoiceId = inv.id;
          }

          let orderRemaining = 0;
          if (totalApplied > 0 && input.order_id) {
            const orderRow = await prisma.org_orders_mst.findUnique({
              where: { id: input.order_id },
              select: { total: true, total_amount: true, paid_amount: true },
            });
            if (orderRow) {
              const orderTotal = Number(orderRow.total ?? orderRow.total_amount ?? 0);
              const currentOrderPaid = Number(orderRow.paid_amount ?? 0);
              const newOrderPaid = currentOrderPaid + totalApplied;
              orderRemaining = Math.max(0, orderTotal - newOrderPaid);
              const orderStatus = newOrderPaid >= orderTotal ? 'paid' : 'partial';
              await updateOrderPaymentStatus(input.order_id, orderStatus, newOrderPaid, input.processed_by);
            }
          }

          return {
            success: true,
            invoice_id: lastInvoiceId ?? '',
            payment_status: 'completed',
            amount_paid: totalApplied,
            remaining_balance: orderRemaining,
            payment_kind: 'invoice',
            metadata: {
              distributed_across_invoices: true,
              amount_applied: totalApplied,
            },
          };
        }
        // No invoices with balance: fall through to create one invoice and pay
      }

      if (!invoiceId) {
        if (!input.order_id) {
          return failResult(input, 0, 'Order or invoice required for invoice payment', 'ORDER_OR_INVOICE_REQUIRED');
        }
        const breakdown =
          input.subtotal != null && input.final_total != null
            ? {
                subtotal: input.subtotal,
                discount: input.discount_amount ?? 0,
                tax: (input.tax_amount ?? 0) + (input.vat_amount ?? 0),
                total: input.final_total,
                vat_rate: input.vat_rate,
                vat_amount: input.vat_amount,
              }
            : undefined;
        const invoice = await createInvoiceForOrder(
          input.order_id,
          input.amount,
          breakdown
        );
        if (!invoice) {
          return failResult(input, 0, 'Failed to create invoice', 'INVOICE_CREATION_FAILED');
        }
        invoiceId = invoice.id;
      }

      const invoice = await prisma.org_invoice_mst.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) {
        return failResult(input, 0, 'Invoice not found', 'INVOICE_NOT_FOUND');
      }

      const remainingBalance = Number(invoice.total) - Number(invoice.paid_amount);
      if (amountToPay > remainingBalance) {
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

      const paymentResult = await processPaymentByMethod(input);
      if (!paymentResult.success) {
        return paymentResult;
      }
      let vCustomerid;
      if (input.customer_id) {
        vCustomerid = input.customer_id;
      } else {
        const customer = await prisma.org_orders_mst.findUnique({
          where: { id: input.order_id },
          select: { customer_id: true },
        });
        if (customer) {
          vCustomerid = customer.customer_id;
        }
      }
       
      const transaction = await recordPaymentTransaction({
        invoice_id: invoiceId,
        order_id: input.order_id,
        customer_id: vCustomerid,
        paid_amount: amountToPay,
        payment_method_code: input.payment_method_code,
        payment_type_code: input.payment_type_code,
        paid_by: input.processed_by,
        branch_id: input.branch_id,
        subtotal: input.subtotal,
        discount_rate: input.discount_rate,
        discount_amount: input.discount_amount,
        manual_discount_amount: input.manual_discount_amount,
        promo_discount_amount: input.promo_discount_amount,
        gift_card_applied_amount: input.gift_card_applied_amount,
        vat_rate: input.vat_rate,
        vat_amount: input.vat_amount,
        tax_rate: input.tax_rate,
        tax_amount: input.tax_amount,
        currency_code: input.currency_code,
        currency_ex_rate: input.currency_ex_rate,
        check_number: input.check_number,
        check_bank: input.check_bank,
        check_date: input.check_date,
        promo_code_id: input.promo_code_id,
        gift_card_id: input.gift_card_id,
        metadata: {
          check_number: input.check_number,
          gateway_token: input.gateway_token,
          promo_code: input.promo_code,
          gift_card_number: input.gift_card_number,
          gift_card_amount: input.gift_card_amount,
        },
        rec_notes: input.notes,
        trans_desc: input.trans_desc,
        payment_channel: input.payment_channel ?? 'web_admin',
      });

      const updatedPaidAmount = Number(invoice.paid_amount) + amountToPay;
      const newStatus = updatedPaidAmount >= Number(invoice.total) ? 'paid' : 'partial';

      const existingInvoiceMetadata =
        invoice.metadata && typeof invoice.metadata === 'object'
          ? (invoice.metadata as Record<string, unknown>)
          : {};
      const paymentMetadata = {
        ...existingInvoiceMetadata,
        last_payment_transaction_id: transaction.id,
        last_payment_at: new Date().toISOString(),
        last_payment_method: input.payment_method_code,
        last_payment_amount: amountToPay,
      };

      await prisma.org_invoice_mst.update({
        where: { id: invoiceId },
        data: {
          paid_amount: updatedPaidAmount,
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date() : undefined,
          paid_by: input.processed_by,
          payment_method_code: input.payment_method_code,
          updated_at: new Date(),
          updated_by: input.processed_by,
          metadata: paymentMetadata as object,
        },
      });

      if (input.order_id) {
        const orderRow = await prisma.org_orders_mst.findUnique({
          where: { id: input.order_id },
          select: { total: true, total_amount: true, paid_amount: true },
        });
        if (orderRow) {
          const orderTotal = Number(orderRow.total ?? orderRow.total_amount ?? 0);
          const currentOrderPaid = Number(orderRow.paid_amount ?? 0);
          const newOrderPaid = currentOrderPaid + amountToPay;
          const orderStatus = newOrderPaid >= orderTotal ? 'paid' : 'partial';
          await updateOrderPaymentStatus(input.order_id, orderStatus, newOrderPaid, input.processed_by);
        }
      }

      return {
        success: true,
        invoice_id: invoiceId,
        transaction_id: transaction.id,
        payment_status: newStatus === 'paid' ? 'completed' : 'completed',
        amount_paid: amountToPay,
        remaining_balance: Number(invoice.total) - updatedPaidAmount,
        payment_kind: 'invoice',
        metadata: {
          transaction_id: transaction.id,
          payment_method: input.payment_method_code,
        },
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return failResult(
        input,
        input.amount,
        error instanceof Error ? error.message : 'Unknown error',
        'PROCESSING_ERROR'
      );
    }
  });
}

function failResult(
  input: ProcessPaymentInput,
  remaining: number,
  error: string,
  code: string
): ProcessPaymentResult {
  return {
    success: false,
    invoice_id: input.invoice_id || '',
    payment_status: 'failed',
    amount_paid: 0,
    remaining_balance: remaining,
    error,
    errorCode: code,
  };
}

/**
 * Process payment based on specific payment method
 */
async function processPaymentByMethod(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  switch (input.payment_method_code) {
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
          gateway: input.payment_method_code.toLowerCase(),
        },
      };

    default:
      return {
        success: false,
        invoice_id: input.invoice_id || '',
        payment_status: 'failed',
        amount_paid: 0,
        remaining_balance: input.amount,
        error: `Unsupported payment method: ${input.payment_method_code}`,
        errorCode: 'UNSUPPORTED_METHOD',
      };
  }
}

/**
 * Record a payment transaction (invoice-linked or standalone deposit/advance/pos)
 * At least one of invoice_id, order_id, or customer_id must be set.
 * Uses tenant settings for currency when not provided; stores calculation breakdown in metadata.
 * When tx is provided, all operations run inside that transaction.
 */
export async function recordPaymentTransaction(
  input: CreatePaymentTransactionInput,
  tx?: PrismaTx
): Promise<PaymentTransaction> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }
  if (!input.invoice_id && !input.order_id && !input.customer_id) {
    throw new Error('At least one of invoice_id, order_id, or customer_id is required');
  }

  const db = tx ?? prisma;

  return withTenantContext(tenantId, async () => {
    // Currency: passed > order > tenant settings
    let currencyCode = input.currency_code;
    let currencyExRate = input.currency_ex_rate;
    if (!currencyCode && input.order_id) {
      const order = await db.org_orders_mst.findUnique({
        where: { id: input.order_id },
        select: { currency_code: true, currency_ex_rate: true },
      });
      currencyCode = order?.currency_code ?? undefined;
      if (currencyExRate == null && order?.currency_ex_rate != null) {
        currencyExRate = Number(order.currency_ex_rate);
      }
    }
    if (!currencyCode) {
      const config = await tenantSettingsService.getCurrencyConfig(tenantId, input.branch_id);
      currencyCode = config.currencyCode;
    }
    if (currencyExRate == null) {
      currencyExRate = 1;
    }

    const hasBreakdown =
      input.subtotal != null ||
      input.discount_amount != null ||
      input.vat_amount != null ||
      input.vat_rate != null ||
      input.tax_rate != null ||
      input.tax_amount != null;
    const calculationBreakdown = hasBreakdown
      ? {
          original_subtotal: input.subtotal ?? 0,
          manual_discount:
            input.manual_discount_amount != null
              ? { type: 'amount' as const, value: input.manual_discount_amount }
              : undefined,
          promo_discount:
            input.promo_discount_amount != null
              ? { code: (input.metadata as { promo_code?: string })?.promo_code ?? '', amount: input.promo_discount_amount }
              : undefined,
          subtotal_after_discounts:
            (input.subtotal ?? 0) - (input.discount_amount ?? 0),
          tax_calculation:
            input.tax_rate != null || input.tax_amount != null
              ? { rate: input.tax_rate, amount: input.tax_amount ?? input.tax ?? 0 }
              : undefined,
          vat_calculation:
            input.vat_rate != null && input.vat_amount != null
              ? { rate: input.vat_rate, amount: input.vat_amount }
              : undefined,
          gift_card_applied:
            input.gift_card_applied_amount != null
              ? { number: (input.metadata as { gift_card_number?: string })?.gift_card_number ?? '', amount: input.gift_card_applied_amount }
              : undefined,
          final_total: input.paid_amount,
        }
      : undefined;

    const metadata = {
      ...(typeof input.metadata === 'object' && input.metadata !== null ? input.metadata : {}),
      ...(calculationBreakdown ? { calculation_breakdown: calculationBreakdown } : {}),
    };
    const hasMetadata = Object.keys(metadata).length > 0;

    // Trans description: Payment for invoice {invoice_id} or order {order_id} or customer {customer_id}
    let vTransDesc = '';
    const tPayments = await getTranslations('payments.table.columns');
    if (input.trans_desc) {
      vTransDesc = input.trans_desc;
    } else {  
      if (input.invoice_id) {
        vTransDesc = tPayments('paymentForTransDescInvoice', { invoice_id: input.invoice_id });
      } else if (input.order_id) {
        vTransDesc = tPayments('paymentForTransDescOrder', { order_id: input.order_id });
      } else if (input.customer_id) {
        vTransDesc = tPayments('paymentForTransDescCustomer', { customer_id: input.customer_id });
      } else {
        vTransDesc = tPayments('paymentForTransDescUnknown');
      }
    }

    // Create receipt voucher first (Enhanced: voucher is parent of payment row)
    const { voucher_id } = await createReceiptVoucherForPayment(
      {
        tenant_org_id: tenantId,
        branch_id: input.branch_id,
        invoice_id: input.invoice_id ?? undefined,
        order_id: input.order_id ?? undefined,
        customer_id: input.customer_id ?? undefined,
        total_amount: input.paid_amount,
        currency_code: currencyCode,
        issued_at: new Date(),
        created_by: input.paid_by ?? undefined,
        auto_issue: true,
      },
      db
    );

    const transaction = await db.org_payments_dtl_tr.create({
      data: {
        tenant_org_id: tenantId,
        branch_id: input.branch_id ?? undefined,
        voucher_id,
        invoice_id: input.invoice_id ?? undefined,
        order_id: input.order_id ?? undefined,
        customer_id: input.customer_id ?? undefined,
        currency_code: currencyCode,
        currency_ex_rate: currencyExRate,
        paid_amount: input.paid_amount,
        payment_method_code: input.payment_method_code,
        payment_type_code: input.payment_type_code ?? undefined,
        tax_amount: input.tax_amount ?? input.tax ?? 0,
        vat_amount: input.vat_amount ?? input.vat ?? 0,
        paid_at: new Date(),
        paid_by: input.paid_by,
        status: 'completed',
        gateway: input.gateway ?? undefined,
        transaction_id: input.transaction_id ?? undefined,
        metadata: hasMetadata ? (metadata as object) : undefined,
        rec_notes: input.rec_notes,
        trans_desc: vTransDesc,
        created_at: new Date(),
        created_by: input.paid_by,
        // First-class amount breakdown and check / channel
        subtotal: input.subtotal ?? undefined,
        discount_rate: input.discount_rate ?? undefined,
        discount_amount: input.discount_amount ?? undefined,
        vat_rate: input.vat_rate ?? undefined,
        manual_discount_amount: input.manual_discount_amount ?? undefined,
        promo_discount_amount: input.promo_discount_amount ?? undefined,
        gift_card_applied_amount: input.gift_card_applied_amount ?? undefined,
        promo_code_id: input.promo_code_id ?? undefined,
        gift_card_id: input.gift_card_id ?? undefined,
        check_number: input.check_number ?? undefined,
        check_bank: input.check_bank ?? undefined,
        check_date: input.check_date ?? undefined,
        payment_channel: input.payment_channel ?? 'web_admin',
      },
    });

    await recordPaymentAudit(
      {
        tenantId,
        paymentId: transaction.id,
        actionType: 'CREATED',
        afterValue: paymentSnapshot(transaction),
        changedBy: input.paid_by ?? '',
      },
      db
    );

    return mapTransactionToType(transaction);
  });
}

function mapTransactionToType(transaction: {
  id: string;
  invoice_id: string | null;
  voucher_id?: string | null;
  tenant_org_id: string;
  branch_id?: string | null;
  order_id: string | null;
  customer_id: string | null;
  currency_code: string;
  paid_amount: unknown;
  status: string | null;
  payment_method_code: string;
  payment_type_code: string | null;
  tax_amount: unknown;
  vat_amount: unknown;
  paid_at: Date | null;
  paid_by: string | null;
  gateway: string | null;
  transaction_id: string | null;
  metadata: unknown;
  rec_notes: string | null;
  trans_desc: string | null;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}): PaymentTransaction {
  return {
    id: transaction.id,
    invoice_id: transaction.invoice_id ?? undefined,
    voucher_id: transaction.voucher_id ?? undefined,
    tenant_org_id: transaction.tenant_org_id,
    branch_id: transaction.branch_id ?? undefined,
    order_id: transaction.order_id ?? undefined,
    customer_id: transaction.customer_id ?? undefined,
    currency_code: transaction.currency_code,
    paid_amount: Number(transaction.paid_amount),
    status: transaction.status as PaymentStatus,
    payment_method_code: transaction.payment_method_code as PaymentMethodCode,
    payment_type_code: transaction.payment_type_code ?? undefined,
    tax: transaction.tax_amount != null ? Number(transaction.tax_amount) : undefined,
    vat: transaction.vat_amount != null ? Number(transaction.vat_amount) : undefined,
    paid_at: transaction.paid_at?.toISOString(),
    paid_by: transaction.paid_by ?? undefined,
    gateway: transaction.gateway as PaymentTransaction['gateway'],
    transaction_id: transaction.transaction_id ?? undefined,
    metadata: transaction.metadata
      ? (typeof transaction.metadata === 'string'
          ? JSON.parse(transaction.metadata)
          : transaction.metadata) as PaymentTransaction['metadata']
      : undefined,
    rec_notes: transaction.rec_notes ?? undefined,
    trans_desc: transaction.trans_desc ?? undefined,
    created_at: transaction.created_at.toISOString(),
    created_by: transaction.created_by ?? undefined,
    updated_at: transaction.updated_at?.toISOString(),
    updated_by: transaction.updated_by ?? undefined,
  };
}

/**
 * Get payment history for an invoice
 */
export async function getPaymentHistory(
  invoiceId: string
): Promise<PaymentTransaction[]> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  const paymentSelect = {
    id: true,
    invoice_id: true,
    tenant_org_id: true,
    order_id: true,
    customer_id: true,
    currency_code: true,
    paid_amount: true,
    status: true,
    payment_method_code: true,
    payment_type_code: true,
    tax_amount: true,
    vat_amount: true,
    paid_at: true,
    paid_by: true,
    gateway: true,
    transaction_id: true,
    metadata: true,
    rec_notes: true,
    created_at: true,
    created_by: true,
    updated_at: true,
    updated_by: true,
  } as const;

  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_payments_dtl_tr.findMany({
      where: { invoice_id: invoiceId },
      orderBy: { created_at: 'desc' },
      select: paymentSelect,
    });
    return transactions.map((t) => mapTransactionToType(t));
  });
}

/**
 * Get payments for an order (including unapplied deposits/pos)
 * @param orderId - Order ID
 * @param sortOrder - 'asc' | 'desc' by created_at (default 'desc' = newest first)
 */
export async function getPaymentsForOrder(
  orderId: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<PaymentTransaction[]> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  const paymentSelect = {
    id: true,
    invoice_id: true,
    voucher_id: true,
    tenant_org_id: true,
    order_id: true,
    customer_id: true,
    currency_code: true,
    paid_amount: true,
    status: true,
    payment_method_code: true,
    payment_type_code: true,
    tax_amount: true,
    vat_amount: true,
    paid_at: true,
    paid_by: true,
    gateway: true,
    transaction_id: true,
    metadata: true,
    rec_notes: true,
    created_at: true,
    created_by: true,
    updated_at: true,
    updated_by: true,
  } as const;

  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_payments_dtl_tr.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: sortOrder },
      select: paymentSelect,
    });
    return transactions.map((t) => mapTransactionToType(t));
  });
}

/**
 * Get payments for a customer (e.g. advance balance)
 */
export async function getPaymentsForCustomer(
  customerId: string
): Promise<PaymentTransaction[]> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  const paymentSelect = {
    id: true,
    invoice_id: true,
    tenant_org_id: true,
    order_id: true,
    customer_id: true,
    currency_code: true,
    paid_amount: true,
    status: true,
    payment_method_code: true,
    payment_type_code: true,
    tax_amount: true,
    vat_amount: true,
    paid_at: true,
    paid_by: true,
    gateway: true,
    transaction_id: true,
    metadata: true,
    rec_notes: true,
    created_at: true,
    created_by: true,
    updated_at: true,
    updated_by: true,
  } as const;

  return withTenantContext(tenantId, async () => {
    const transactions = await prisma.org_payments_dtl_tr.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      select: paymentSelect,
    });
    return transactions.map((t) => mapTransactionToType(t));
  });
}

/**
 * Apply an unapplied payment (deposit/advance/pos) to an invoice
 */
export async function applyPaymentToInvoice(
  paymentId: string,
  invoiceId: string,
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return { success: false, error: 'Unauthorized: Tenant ID required' };
  }

  return withTenantContext(tenantId, async () => {
    const payment = await prisma.org_payments_dtl_tr.findFirst({
      where: { id: paymentId },
    });
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }
    if (payment.invoice_id != null) {
      return { success: false, error: 'Payment is already applied to an invoice' };
    }
    const amount = Number(payment.paid_amount);
    if (amount <= 0) {
      return { success: false, error: 'Payment amount must be positive' };
    }

    const invoice = await prisma.org_invoice_mst.findFirst({
      where: { id: invoiceId },
    });
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    await prisma.org_payments_dtl_tr.update({
      where: { id: paymentId },
      data: {
        invoice_id: invoiceId,
        updated_at: new Date(),
        updated_by: updatedBy ?? undefined,
      },
    });

    const newPaidAmount = Number(invoice.paid_amount) + amount;
    const newStatus = newPaidAmount >= Number(invoice.total) ? 'paid' : 'partial';
    await prisma.org_invoice_mst.update({
      where: { id: invoiceId },
      data: {
        paid_amount: newPaidAmount,
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date() : undefined,
        paid_by: updatedBy ?? undefined,
        payment_method_code: payment.payment_method_code ?? undefined,
        updated_at: new Date(),
        updated_by: updatedBy ?? undefined,
      },
    });

    if (payment.order_id) {
      const order = await prisma.org_orders_mst.findUnique({
        where: { id: payment.order_id },
      });
      if (order) {
        const orderPaid = Number(order.paid_amount ?? 0) + amount;
        const orderTotal = Number(order.total ?? 0);
        await prisma.org_orders_mst.update({
          where: { id: payment.order_id },
          data: {
            paid_amount: orderPaid,
            payment_status: orderPaid >= orderTotal ? 'paid' : 'partial',
            paid_at: orderPaid >= orderTotal ? new Date() : undefined,
            updated_at: new Date(),
            updated_by: updatedBy ?? undefined,
          },
        });
      }
    }

    return { success: true };
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
    const methodValidation = await validatePaymentMethod(input.payment_method_code);
    if (!methodValidation.isValid) {
      errors.push({
        field: 'payment_method',
        message: methodValidation.error || 'Invalid payment method',
        code: 'INVALID_METHOD',
      });
    }

    // Validate check number if payment method is CHECK
    if (input.payment_method_code === 'CHECK' && !input.check_number) {
      errors.push({
        field: 'check_number',
        message: 'Check number is required for check payments',
        code: 'CHECK_NUMBER_REQUIRED',
      });
    }

    const kind = input.payment_kind ?? 'invoice';
    const isNonInvoice = (kind === 'deposit' || kind === 'advance' || kind === 'pos') && !input.invoice_id;

    if (isNonInvoice) {
      if (kind === 'advance') {
        if (!input.customer_id) {
          errors.push({
            field: 'customer_id',
            message: 'Customer is required for advance payment',
            code: 'CUSTOMER_REQUIRED',
          });
        } else {
          const customer = await prisma.org_customers_mst.findUnique({
            where: { id: input.customer_id },
          });
          if (!customer) {
            errors.push({
              field: 'customer_id',
              message: 'Customer not found',
              code: 'CUSTOMER_NOT_FOUND',
            });
          }
        }
      } else {
        if (!input.order_id) {
          errors.push({
            field: 'order_id',
            message: 'Order is required for deposit or POS payment',
            code: 'ORDER_REQUIRED',
          });
        } else {
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
        }
      }
    } else {
      if (!input.invoice_id && !input.order_id) {
        errors.push({
          field: 'order_id',
          message: 'Order or invoice is required for invoice payment',
          code: 'ORDER_OR_INVOICE_REQUIRED',
        });
      } else if (input.order_id) {
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
      }
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
  paidAmount: number,
  userId?: string
): Promise<void> {
  // Middleware adds tenant_org_id automatically since we're within tenant context
  await prisma.org_orders_mst.update({
    where: { id: orderId },
    data: {
      payment_status: status,
      paid_amount: paidAmount,
      paid_at: status === 'paid' ? new Date() : undefined,
      updated_at: new Date(),
      ...(userId && { updated_by: userId }),
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
 * Process a payment refund.
 * Only completed payments can be refunded. Reverses invoice and order paid_amount in same transaction.
 */
export async function refundPayment(
  input: RefundPaymentInput
): Promise<RefundPaymentResult> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return {
      success: false,
      refund_transaction_id: '',
      refund_amount: 0,
      error: 'Unauthorized: Tenant ID required',
    };
  }

  return withTenantContext(tenantId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const transaction = await tx.org_payments_dtl_tr.findFirst({
          where: { id: input.transaction_id, tenant_org_id: tenantId },
        });

        if (!transaction) {
          return {
            success: false,
            refund_transaction_id: '',
            refund_amount: 0,
            error: 'Transaction not found',
          };
        }

        if (transaction.status !== 'completed') {
          return {
            success: false,
            refund_transaction_id: '',
            refund_amount: 0,
            error: 'Only completed payments can be refunded',
          };
        }

        const originalAmount = Number(transaction.paid_amount);
        if (input.amount <= 0) {
          return {
            success: false,
            refund_transaction_id: '',
            refund_amount: 0,
            error: 'Refund amount must be greater than zero',
          };
        }

        // Sum existing refunds for this original transaction (prevents double-refund)
        const existingRefundRows = await tx.org_payments_dtl_tr.findMany({
          where: {
            tenant_org_id: tenantId,
            paid_amount: { lt: 0 },
            metadata: {
              path: ['original_transaction_id'],
              equals: input.transaction_id,
            },
          },
          select: { paid_amount: true },
        });
        const totalRefundedSoFar = existingRefundRows.reduce(
          (sum, r) => sum + Math.abs(Number(r.paid_amount)),
          0
        );
        const remainingRefundable = originalAmount - totalRefundedSoFar;
        if (remainingRefundable <= 0) {
          return {
            success: false,
            refund_transaction_id: '',
            refund_amount: 0,
            error: 'This payment has already been fully refunded',
          };
        }
        if (input.amount > remainingRefundable) {
          return {
            success: false,
            refund_transaction_id: '',
            refund_amount: 0,
            error: `Refund amount exceeds remaining refundable amount (${remainingRefundable.toFixed(4)}). Already refunded: ${totalRefundedSoFar.toFixed(4)}`,
          };
        }

        const refundTransaction = await tx.org_payments_dtl_tr.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: transaction.branch_id ?? undefined,
            invoice_id: transaction.invoice_id ?? undefined,
            order_id: transaction.order_id ?? undefined,
            customer_id: transaction.customer_id ?? undefined,
            currency_code: transaction.currency_code,
            currency_ex_rate: transaction.currency_ex_rate ?? 1,
            paid_amount: -input.amount,
            payment_method_code: transaction.payment_method_code,
            payment_type_code: transaction.payment_type_code ?? undefined,
            tax_amount: transaction.tax_amount ?? 0,
            vat_amount: transaction.vat_amount ?? 0,
            paid_at: new Date(),
            paid_by: input.processed_by ?? undefined,
            status: 'refunded',
            gateway: transaction.gateway ?? undefined,
            metadata: {
              original_transaction_id: input.transaction_id,
              refund_reason: input.reason,
            },
            rec_notes: `Refund: ${input.reason}`,
            created_at: new Date(),
            created_by: input.processed_by ?? undefined,
          },
        });
        
        if (transaction.invoice_id) {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id: transaction.invoice_id },
          });
          if (invoice) {
            const newPaidAmount = Math.max(0, Number(invoice.paid_amount) - input.amount);
            const invoiceTotal = Number(invoice.total);
            const newStatus =
              newPaidAmount <= 0 ? 'pending' : newPaidAmount >= invoiceTotal ? 'paid' : 'partial';
            await tx.org_invoice_mst.update({
              where: { id: invoice.id },
              data: {
                paid_amount: newPaidAmount,
                status: newStatus,
                updated_at: new Date(),
                updated_by: input.processed_by ?? undefined,
              },
            });
          }
        }

        if (transaction.order_id) {
          const order = await tx.org_orders_mst.findUnique({
            where: { id: transaction.order_id },
          });
          if (order) {
            const newOrderPaid = Math.max(0, Number(order.paid_amount ?? 0) - input.amount);
            const orderTotal = Number(order.total ?? 0);
            const newPaymentStatus =
              newOrderPaid <= 0
                ? 'pending'
                : newOrderPaid >= orderTotal
                  ? 'paid'
                  : 'partial';
            await tx.org_orders_mst.update({
              where: { id: order.id },
              data: {
                paid_amount: newOrderPaid,
                payment_status: newPaymentStatus,
                updated_at: new Date(),
                updated_by: input.processed_by ?? undefined,
              },
            });
          }
        }

        await recordPaymentAudit(
          {
            tenantId,
            paymentId: refundTransaction.id,
            actionType: 'REFUNDED',
            beforeValue: {
              original_payment_id: input.transaction_id,
              original_paid_amount: originalAmount,
              refund_amount: input.amount,
            },
            afterValue: {
              refund_transaction_id: refundTransaction.id,
              refund_amount: input.amount,
            },
            changedBy: input.processed_by ?? '',
            metadata: { reason: input.reason },
          },
          tx as Parameters<typeof recordPaymentAudit>[1]
        );

        return {
          success: true,
          refund_transaction_id: refundTransaction.id,
          refund_amount: input.amount,
        };
      });
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
// Payment List & Stats Functions
// ============================================================================

/**
 * List all payments with filtering and pagination
 */
export async function listPayments(params: {
  tenantOrgId: string;
  page?: number;
  limit?: number;
  status?: string[];
  paymentMethodCode?: string[];
  kind?: string[];
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const {
    tenantOrgId,
    page = 1,
    limit = 20,
    status,
    paymentMethodCode,
    kind,
    customerId,
    orderId,
    invoiceId,
    startDate,
    endDate,
    searchQuery,
    sortBy = 'paid_at',
    sortOrder = 'desc',
  } = params;

  return withTenantContext(tenantOrgId, async () => {
    // Build where clause
    const where: any = {
      tenant_org_id: tenantOrgId,
    };

    // Apply filters
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (paymentMethodCode && paymentMethodCode.length > 0) {
      where.payment_method_code = { in: paymentMethodCode };
    }

    // Note: kind is stored in metadata JSON field, not as a separate column
    // Filtering by kind would require JSON filtering which is more complex
    // For now, we skip kind filtering in the database query

    if (customerId) {
      where.customer_id = customerId;
    }

    if (orderId) {
      where.order_id = orderId;
    }

    if (invoiceId) {
      where.invoice_id = invoiceId;
    }

    if (startDate || endDate) {
      where.paid_at = {};
      if (startDate) {
        where.paid_at.gte = startDate;
      }
      if (endDate) {
        where.paid_at.lte = endDate;
      }
    }

    // Search by transaction ID or customer name (requires join)
    if (searchQuery) {
      where.OR = [
        { transaction_id: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const totalCount = await prisma.org_payments_dtl_tr.count({ where });

    // Build orderBy clause
    const allowedSortFields = [
      'paid_at', 'created_at', 'paid_amount', 'status',
      'payment_method_code', 'currency_code', 'transaction_id',
      'subtotal', 'discount_amount', 'tax_amount', 'vat_amount',
      'gateway', 'payment_channel',
    ];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'paid_at';
    const orderByClause: any[] = [
      { [orderByField]: sortOrder },
    ];
    // Secondary sort by created_at for stable ordering
    if (orderByField !== 'created_at') {
      orderByClause.push({ created_at: 'desc' });
    }

    // Get paginated results with joins
    const payments = await prisma.org_payments_dtl_tr.findMany({
      where,
      include: {
        org_customers_mst: {
          select: {
            name: true,
            name2: true,
          },
        },
        org_orders_mst: {
          select: {
            order_no: true,
          },
        },
        org_invoice_mst: {
          select: {
            invoice_no: true,
          },
        },
        sys_payment_method_cd: {
          select: {
            payment_method_name: true,
            payment_method_name2: true,
          },
        },
        sys_payment_type_cd: {
          select: {
            payment_type_name: true,
            payment_type_name2: true,
          },
        },
      },
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
    });

    // Transform to PaymentListItem
    const paymentListItems = payments.map(mapPaymentToListItem);
    const paymentIds = new Set(payments.map((p) => p.id));

    // Mark hasRefunds for payments that have any refund rows (so UI can hide Cancel)
    const refundRows = await prisma.org_payments_dtl_tr.findMany({
      where: { tenant_org_id: tenantOrgId, paid_amount: { lt: 0 } },
      select: { metadata: true },
    });
    const idsWithRefunds = new Set<string>();
    for (const row of refundRows) {
      const meta = row.metadata;
      if (meta && typeof meta === 'object' && 'original_transaction_id' in meta) {
        const orig = (meta as { original_transaction_id?: string }).original_transaction_id;
        if (typeof orig === 'string' && paymentIds.has(orig)) idsWithRefunds.add(orig);
      }
    }
    paymentListItems.forEach((item) => {
      item.hasRefunds = idsWithRefunds.has(item.id);
    });

    return {
      payments: paymentListItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  });
}

/**
 * Get payment statistics for a tenant
 */
export async function getPaymentStats(params: {
  tenantOrgId: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { tenantOrgId, startDate, endDate } = params;

  return withTenantContext(tenantOrgId, async () => {
    const where: any = {
      tenant_org_id: tenantOrgId,
    };

    if (startDate || endDate) {
      where.paid_at = {};
      if (startDate) {
        where.paid_at.gte = startDate;
      }
      if (endDate) {
        where.paid_at.lte = endDate;
      }
    }

    // Get all payments for aggregation
    const allPayments = await prisma.org_payments_dtl_tr.findMany({
      where,
      select: {
        status: true,
        paid_amount: true,
        payment_method_code: true,
        paid_at: true,
        created_at: true,
      },
    });

    // Calculate total count and amount
    const totalCount = allPayments.length;
    const totalAmount = allPayments.reduce(
      (sum, p) => sum + Number(p.paid_amount),
      0
    );

    // Calculate by status
    const byStatus: Record<string, { count: number; amount: number }> = {};
    allPayments.forEach((payment) => {
      const status = payment.status;
      if (!byStatus[status]) {
        byStatus[status] = { count: 0, amount: 0 };
      }
      byStatus[status].count++;
      byStatus[status].amount += Number(payment.paid_amount);
    });

    // Calculate by method
    const byMethod: Record<string, { count: number; amount: number }> = {};
    allPayments.forEach((payment) => {
      const method = payment.payment_method_code;
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 };
      }
      byMethod[method].count++;
      byMethod[method].amount += Number(payment.paid_amount);
    });

    // Calculate recent trends
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = allPayments.filter(
      (p) => (p.paid_at || p.created_at) >= todayStart
    ).length;

    const thisWeek = allPayments.filter(
      (p) => (p.paid_at || p.created_at) >= weekStart
    ).length;

    const thisMonth = allPayments.filter(
      (p) => (p.paid_at || p.created_at) >= monthStart
    ).length;

    return {
      totalCount,
      totalAmount,
      byStatus,
      byMethod,
      recentTrends: {
        today,
        thisWeek,
        thisMonth,
      },
    };
  });
}

// ============================================================================
// Shared Payment Mapping Helper
// ============================================================================

/**
 * Map a raw Prisma payment record (with joins) to PaymentListItem
 */
function mapPaymentToListItem(payment: {
  id: string;
  invoice_id: string | null;
  tenant_org_id: string;
  branch_id?: string | null;
  order_id: string | null;
  customer_id: string | null;
  currency_code: string;
  paid_amount: unknown;
  status: string | null;
  due_date: Date | null;
  payment_method_code: string;
  payment_type_code: string | null;
  tax_amount: unknown;
  vat_amount: unknown;
  paid_at: Date | null;
  paid_by: string | null;
  gateway: string | null;
  transaction_id: string | null;
  metadata: unknown;
  rec_notes: string | null;
  trans_desc: string | null;
  created_at: Date;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
  subtotal?: unknown;
  discount_rate?: unknown;
  discount_amount?: unknown;
  manual_discount_amount?: unknown;
  promo_discount_amount?: unknown;
  gift_card_applied_amount?: unknown;
  vat_rate?: unknown;
  currency_ex_rate?: unknown;
  check_number?: string | null;
  check_bank?: string | null;
  check_date?: Date | null;
  payment_channel?: string | null;
  org_customers_mst?: { name: string | null; name2: string | null } | null;
  org_orders_mst?: { order_no: string | null } | null;
  org_invoice_mst?: { invoice_no: string | null } | null;
  sys_payment_method_cd?: { payment_method_name: string | null; payment_method_name2: string | null } | null;
  sys_payment_type_cd?: { payment_type_name: string | null; payment_type_name2: string | null } | null;
}): PaymentListItem {
  return {
    id: payment.id,
    invoice_id: payment.invoice_id ?? undefined,
    tenant_org_id: payment.tenant_org_id,
    branch_id: payment.branch_id ?? undefined,
    order_id: payment.order_id ?? undefined,
    customer_id: payment.customer_id ?? undefined,
    currency_code: payment.currency_code,
    paid_amount: Number(payment.paid_amount),
    status: (payment.status ?? 'pending') as PaymentStatus,
    due_date: payment.due_date?.toISOString() ?? undefined,
    payment_method_code: payment.payment_method_code as PaymentMethodCode,
    payment_type_code: payment.payment_type_code ?? undefined,
    tax: payment.tax_amount != null ? Number(payment.tax_amount) : undefined,
    vat: payment.vat_amount != null ? Number(payment.vat_amount) : undefined,
    paid_at: payment.paid_at?.toISOString() ?? undefined,
    paid_by: payment.paid_by ?? undefined,
    gateway: payment.gateway as PaymentTransaction['gateway'],
    transaction_id: payment.transaction_id ?? undefined,
    metadata: payment.metadata
      ? (typeof payment.metadata === 'string'
          ? JSON.parse(payment.metadata)
          : payment.metadata) as PaymentTransaction['metadata']
      : undefined,
    rec_notes: payment.rec_notes ?? undefined,
    trans_desc: payment.trans_desc ?? undefined,
    created_at: payment.created_at.toISOString(),
    created_by: payment.created_by ?? undefined,
    updated_at: payment.updated_at?.toISOString() ?? undefined,
    updated_by: payment.updated_by ?? undefined,
    // Extended fields
    subtotal: payment.subtotal != null ? Number(payment.subtotal) : undefined,
    discount_rate: payment.discount_rate != null ? Number(payment.discount_rate) : undefined,
    discount_amount: payment.discount_amount != null ? Number(payment.discount_amount) : undefined,
    manual_discount_amount: payment.manual_discount_amount != null ? Number(payment.manual_discount_amount) : undefined,
    promo_discount_amount: payment.promo_discount_amount != null ? Number(payment.promo_discount_amount) : undefined,
    gift_card_applied_amount: payment.gift_card_applied_amount != null ? Number(payment.gift_card_applied_amount) : undefined,
    vat_rate: payment.vat_rate != null ? Number(payment.vat_rate) : undefined,
    currency_ex_rate: payment.currency_ex_rate != null ? Number(payment.currency_ex_rate) : undefined,
    check_number: payment.check_number ?? undefined,
    check_bank: payment.check_bank ?? undefined,
    check_date: payment.check_date?.toISOString() ?? undefined,
    payment_channel: payment.payment_channel ?? undefined,
    // Joined fields
    customerName: payment.org_customers_mst?.name ?? undefined,
    customerName2: payment.org_customers_mst?.name2 ?? undefined,
    orderReference: payment.org_orders_mst?.order_no ?? undefined,
    invoiceNumber: payment.org_invoice_mst?.invoice_no ?? undefined,
    paymentMethodName: payment.sys_payment_method_cd?.payment_method_name ?? undefined,
    paymentMethodName2: payment.sys_payment_method_cd?.payment_method_name2 ?? undefined,
    paymentTypeName: payment.sys_payment_type_cd?.payment_type_name ?? undefined,
    paymentTypeName2: payment.sys_payment_type_cd?.payment_type_name2 ?? undefined,
  };
}

// ============================================================================
// Single Payment CRUD Functions
// ============================================================================

/** Shared include clause for payment queries with joins */
const PAYMENT_LIST_INCLUDE = {
  org_customers_mst: { select: { name: true, name2: true } },
  org_orders_mst: { select: { order_no: true } },
  org_invoice_mst: { select: { invoice_no: true } },
  sys_payment_method_cd: { select: { payment_method_name: true, payment_method_name2: true } },
  sys_payment_type_cd: { select: { payment_type_name: true, payment_type_name2: true } },
} as const;

/**
 * Get a single payment by ID with all joined fields
 */
export async function getPaymentById(paymentId: string): Promise<PaymentListItem | null> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  return withTenantContext(tenantId, async () => {
    const payment = await prisma.org_payments_dtl_tr.findFirst({
      where: { id: paymentId, tenant_org_id: tenantId },
      include: PAYMENT_LIST_INCLUDE,
    });

    if (!payment) return null;

    const hasRefunds =
      (await prisma.org_payments_dtl_tr.count({
        where: {
          tenant_org_id: tenantId,
          paid_amount: { lt: 0 },
          metadata: {
            path: ['original_transaction_id'],
            equals: paymentId,
          },
        },
      })) > 0;

    const item = mapPaymentToListItem(payment);
    item.hasRefunds = hasRefunds;
    return item;
  });
}

/**
 * Update payment notes (rec_notes)
 * Rejects if payment is cancelled or refunded.
 */
export async function updatePaymentNotes(
  paymentId: string,
  notes: string,
  updatedBy: string
): Promise<PaymentTransaction> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }

  return withTenantContext(tenantId, async () => {
    const payment = await prisma.org_payments_dtl_tr.findFirst({
      where: { id: paymentId, tenant_org_id: tenantId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'cancelled' || payment.status === 'refunded') {
      throw new Error(`Cannot update notes on a ${payment.status} payment`);
    }

    const updated = await prisma.org_payments_dtl_tr.update({
      where: { id: paymentId },
      data: {
        rec_notes: notes,
        updated_at: new Date(),
        updated_by: updatedBy,
      },
    });

    await recordPaymentAudit({
      tenantId,
      paymentId,
      actionType: 'NOTES_UPDATED',
      beforeValue: { rec_notes: payment.rec_notes },
      afterValue: { rec_notes: notes },
      changedBy: updatedBy,
    });

    return mapTransactionToType(updated);
  });
}

/**
 * Cancel a payment and reverse linked invoice/order balances.
 * Rejects if already cancelled or refunded.
 * Stores cancel reason in rec_notes, cancelled_by/cancelled_at in metadata.
 */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  cancelledBy: string
): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return { success: false, error: 'Unauthorized: Tenant ID required' };
  }

  return withTenantContext(tenantId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const payment = await tx.org_payments_dtl_tr.findFirst({
          where: { id: paymentId, tenant_org_id: tenantId },
        });

        if (!payment) {
          return { success: false, error: 'Payment not found' };
        }

        if (payment.status === 'cancelled') {
          return { success: false, error: 'Payment is already cancelled' };
        }
        if (payment.status === 'refunded') {
          return { success: false, error: 'Cannot cancel a refunded payment' };
        }

        // Reject cancel if any refund has been issued for this payment (original row stays "completed")
        const existingRefundCount = await tx.org_payments_dtl_tr.count({
          where: {
            tenant_org_id: tenantId,
            paid_amount: { lt: 0 },
            metadata: {
              path: ['original_transaction_id'],
              equals: paymentId,
            },
          },
        });
        if (existingRefundCount > 0) {
          return {
            success: false,
            error: 'Cannot cancel a payment that has been refunded',
          };
        }

        const existingMetadata =
          payment.metadata && typeof payment.metadata === 'object'
            ? (payment.metadata as Record<string, unknown>)
            : {};

        // 1. Update payment status to cancelled
        await tx.org_payments_dtl_tr.update({
          where: { id: paymentId },
          data: {
            status: 'cancelled',
            rec_notes: reason,
            metadata: {
              ...existingMetadata,
              cancelled_by: cancelledBy,
              cancelled_at: new Date().toISOString(),
              cancel_reason: reason,
            } as object,
            updated_at: new Date(),
            updated_by: cancelledBy,
          },
        });

        await recordPaymentAudit(
          {
            tenantId,
            paymentId,
            actionType: 'CANCELLED',
            beforeValue: paymentSnapshot(payment),
            afterValue: { status: 'cancelled', rec_notes: reason },
            changedBy: cancelledBy,
            metadata: { reason },
          },
          tx as Parameters<typeof recordPaymentAudit>[1]
        );

        const paidAmount = Number(payment.paid_amount);

        // 2. Reverse invoice paid_amount if linked
        if (payment.invoice_id) {
          const invoice = await tx.org_invoice_mst.findUnique({
            where: { id: payment.invoice_id },
          });

          if (invoice) {
            const newPaidAmount = Math.max(0, Number(invoice.paid_amount) - paidAmount);
            const invoiceTotal = Number(invoice.total);
            let newStatus: string;
            if (newPaidAmount <= 0) {
              newStatus = 'pending';
            } else if (newPaidAmount >= invoiceTotal) {
              newStatus = 'paid';
            } else {
              newStatus = 'partial';
            }

            await tx.org_invoice_mst.update({
              where: { id: payment.invoice_id },
              data: {
                paid_amount: newPaidAmount,
                status: newStatus,
                updated_at: new Date(),
                updated_by: cancelledBy,
              },
            });
          }
        }

        // 3. Reverse order paid_amount if linked
        if (payment.order_id) {
          const order = await tx.org_orders_mst.findUnique({
            where: { id: payment.order_id },
          });

          if (order) {
            const newOrderPaid = Math.max(0, Number(order.paid_amount ?? 0) - paidAmount);
            const orderTotal = Number(order.total ?? 0);
            let newPaymentStatus: string;
            if (newOrderPaid <= 0) {
              newPaymentStatus = 'pending';
            } else if (newOrderPaid >= orderTotal) {
              newPaymentStatus = 'paid';
            } else {
              newPaymentStatus = 'partial';
            }

            await tx.org_orders_mst.update({
              where: { id: payment.order_id },
              data: {
                paid_amount: newOrderPaid,
                payment_status: newPaymentStatus,
                updated_at: new Date(),
                updated_by: cancelledBy,
              },
            });
          }
        }

        return { success: true };
      });
    } catch (error) {
      console.error('Error cancelling payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel payment',
      };
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

interface InvoiceBreakdown {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  vat_rate?: number;
  vat_amount?: number;
}

/**
 * Create an invoice for an order.
 * Uses optional breakdown when provided; otherwise subtotal/total = amount, discount/tax = 0.
 */
async function createInvoiceForOrder(
  orderId: string,
  amount: number,
  breakdown?: InvoiceBreakdown
): Promise<{ id: string } | null> {
  try {
    const order = await prisma.org_orders_mst.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return null;
    }

    const subtotal = breakdown?.subtotal ?? amount;
    const discount = breakdown?.discount ?? 0;
    const tax = breakdown?.tax ?? 0;
    const total = breakdown?.total ?? amount;

    const currencyCode =
      order.currency_code ??
      (await tenantSettingsService.getCurrencyConfig(order.tenant_org_id, order.branch_id ?? undefined)).currencyCode;
    const currencyExRate = Number(order.currency_ex_rate ?? 1);

    const now = new Date();
    const invoice = await prisma.org_invoice_mst.create({
      data: {
        order_id: orderId,
        customer_id: order.customer_id,
        tenant_org_id: order.tenant_org_id,
        branch_id: order.branch_id ?? undefined,
        invoice_no: await generateInvoiceNumber(order.tenant_org_id),
        invoice_date: now,
        subtotal,
        discount,
        tax,
        total,
        currency_code: currencyCode,
        currency_ex_rate: currencyExRate,
        payment_terms: order.payment_terms ?? undefined,
        service_charge: order.service_charge ?? undefined,
        service_charge_type: order.service_charge_type ?? undefined,
        gift_card_id: order.gift_card_id ?? undefined,
        gift_card_discount_amount: order.gift_card_discount_amount ?? undefined,
        tax_rate: order.tax_rate ?? undefined,
        vat_rate: breakdown?.vat_rate ?? order.vat_rate ?? undefined,
        vat_amount: breakdown?.vat_amount ?? order.vat_amount ?? undefined,
        status: 'pending',
        paid_amount: 0,
        created_at: now,
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
