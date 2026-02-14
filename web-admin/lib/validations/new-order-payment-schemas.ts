/**
 * New Order Payment – shared Zod schemas
 * Used by Payment modal, submission hook, createInvoiceAction, processPayment, delete-order.
 * Single source of truth for validation and types.
 */

import { z } from 'zod';

// Payment method codes (server/action side – uppercase)
const paymentMethodCodeSchema = z.enum([
  'CASH',
  'CARD',
  'CHECK',
  'PAY_ON_COLLECTION',
  'INVOICE',
  'HYPERPAY',
  'PAYTABS',
  'STRIPE',
  'BANK_TRANSFER',
  'MOBILE_PAYMENT',
]);

// ---------------------------------------------------------------------------
// Extended payload (modal → submission hook)
// ---------------------------------------------------------------------------

export const newOrderPaymentTotalsSchema = z.object({
  subtotal: z.number().min(0),
  manualDiscount: z.number().min(0).optional(),
  promoDiscount: z.number().min(0).optional(),
  afterDiscounts: z.number().min(0).optional(),
  /** Tax rate (%); distinct from VAT */
  taxRate: z.number().min(0).optional(),
  /** Tax amount; distinct from VAT amount */
  taxAmount: z.number().min(0).optional(),
  vatTaxPercent: z.number().min(0).optional(),
  vatValue: z.number().min(0),
  giftCardApplied: z.number().min(0).optional(),
  finalTotal: z.number().min(0),
});

export const newOrderPaymentPayloadSchema = z
  .object({
    amountToCharge: z.number().min(0),
    totals: newOrderPaymentTotalsSchema,
    currencyCode: z.string().length(3).optional(),
    currencyExRate: z.number().min(0).optional(),
  })
  .refine(
    (data) => data.amountToCharge <= data.totals.finalTotal + 0.001,
    { message: 'Amount to charge cannot exceed total', path: ['amountToCharge'] }
  );

export type NewOrderPaymentTotals = z.infer<typeof newOrderPaymentTotalsSchema>;
export type NewOrderPaymentPayload = z.infer<typeof newOrderPaymentPayloadSchema>;

// ---------------------------------------------------------------------------
// Preview Payment API input
// ---------------------------------------------------------------------------

export const previewPaymentRequestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().positive(),
    })
  ).min(1),
  customerId: z.string().uuid().optional(),
  isExpress: z.boolean().optional(),
  percentDiscount: z.number().min(0).max(100).optional(),
  amountDiscount: z.number().min(0).optional(),
  promoCode: z.string().optional(),
  giftCardNumber: z.string().optional(),
});

export type PreviewPaymentRequest = z.infer<typeof previewPaymentRequestSchema>;

// ---------------------------------------------------------------------------
// Create With Payment API input
// ---------------------------------------------------------------------------

export const clientTotalsSchema = z.object({
  subtotal: z.number().min(0),
  manualDiscount: z.number().min(0).optional(),
  promoDiscount: z.number().min(0).optional(),
  vatValue: z.number().min(0),
  finalTotal: z.number().min(0),
});

export const createWithPaymentRequestSchema = z.object({
  customerId: z.string(),
  orderTypeId: z.string().default('POS'),
  /** Additional tax rate in percent (e.g. 10 for 10%). Applied to afterDiscounts. */
  additionalTaxRate: z.number().min(0).max(100).optional(),
  /** Additional tax amount. If provided, overrides rate-based calculation. */
  additionalTaxAmount: z.number().min(0).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      productName: z.string().nullable().optional(),
      productName2: z.string().nullable().optional(),
      quantity: z.number().positive(),
      pricePerUnit: z.number().nonnegative(),
      totalPrice: z.number().nonnegative(),
      serviceCategoryCode: z.string().optional(),
      notes: z.string().optional(),
      hasStain: z.boolean().optional(),
      hasDamage: z.boolean().optional(),
      stainNotes: z.string().optional(),
      damageNotes: z.string().optional(),
      pieces: z.array(z.object({
        pieceSeq: z.number().positive(),
        color: z.string().optional(),
        brand: z.string().optional(),
        hasStain: z.boolean().optional(),
        hasDamage: z.boolean().optional(),
        notes: z.string().optional(),
        rackLocation: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })).optional(),
    })
  ).min(1),
  isQuickDrop: z.boolean().optional(),
  quickDropQuantity: z.number().positive().optional(),
  express: z.boolean().optional(),
  customerNotes: z.string().optional(),
  readyByAt: z.string().datetime().optional(),
  paymentMethod: z.string(),
  percentDiscount: z.number().min(0).max(100).optional(),
  amountDiscount: z.number().min(0).optional(),
  promoCode: z.string().optional(),
  promoCodeId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ),
  promoDiscount: z.number().min(0).optional(),
  giftCardNumber: z.string().optional(),
  giftCardAmount: z.number().min(0).optional(),
  giftCardId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ),
  checkNumber: z.string().optional(),
  checkBank: z.string().optional(),
  checkDate: z.string().optional(),
  branchId: z.string().uuid().optional(),
  clientTotals: clientTotalsSchema,
});

export type CreateWithPaymentRequest = z.infer<typeof createWithPaymentRequestSchema>;
export type ClientTotals = z.infer<typeof clientTotalsSchema>;

// ---------------------------------------------------------------------------
// createInvoiceAction input
// ---------------------------------------------------------------------------

export const createInvoiceInputSchema = z.object({
  order_id: z.string().uuid(),
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  due_date: z.string().optional(),
  payment_method_code: paymentMethodCodeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  rec_notes: z.string().optional(),
});

export type CreateInvoiceInputValidated = z.infer<typeof createInvoiceInputSchema>;

// ---------------------------------------------------------------------------
// processPayment action input (for new-order flow: orderId, amount, method)
// ---------------------------------------------------------------------------

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const processPaymentActionInputSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    invoiceId: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === '' || uuidRegex.test(v), {
        message: 'Invalid UUID',
      }),
    customerId: z.string().uuid().optional(),
    paymentKind: z.enum(['invoice', 'deposit', 'advance', 'pos']).optional(),
    paymentMethod: paymentMethodCodeSchema,
    amount: z.number().positive(),
    checkNumber: z.string().optional(),
    checkBank: z.string().optional(),
    checkDate: z.date().optional(),
    manualDiscount: z.number().min(0).optional(),
    promoCode: z.string().optional(),
    promoCodeId: z.string().uuid().optional(),
    giftCardNumber: z.string().optional(),
    giftCardAmount: z.number().min(0).optional(),
    giftCardId: z.string().uuid().optional(),
    notes: z.string().optional(),
    // Amount breakdown (new-order flow)
    subtotal: z.number().min(0).optional(),
    discountRate: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    manualDiscountAmount: z.number().min(0).optional(),
    promoDiscountAmount: z.number().min(0).optional(),
    giftCardAppliedAmount: z.number().min(0).optional(),
    vatRate: z.number().min(0).max(100).optional(),
    vatAmount: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    taxAmount: z.number().min(0).optional(),
    finalTotal: z.number().min(0).optional(),
    currencyCode: z.string().length(3).optional(),
    currencyExRate: z.number().min(0).optional(),
    branchId: z.string().uuid().optional(),
    paymentTypeCode: z.string().optional(),
    /** When true and no invoiceId: apply payment across all order invoices with balance (FIFO) */
    distributeAcrossInvoices: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.paymentKind !== 'invoice' ||
      (typeof data.invoiceId === 'string' && data.invoiceId.length > 0 && uuidRegex.test(data.invoiceId)) ||
      (typeof data.orderId === 'string' && data.orderId.length > 0 && uuidRegex.test(data.orderId)),
    {
      message:
        'Either an invoice or an order is required for invoice payment (order allows creating the invoice).',
      path: ['invoiceId'],
    }
  );

export type ProcessPaymentActionInputValidated = z.infer<
  typeof processPaymentActionInputSchema
>;

// ---------------------------------------------------------------------------
// delete-order action input (rollback)
// ---------------------------------------------------------------------------

export const deleteOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  tenantOrgId: z.string().uuid(),
});

export type DeleteOrderInput = z.infer<typeof deleteOrderInputSchema>;
