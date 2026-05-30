/**
 * New Order Payment – shared Zod schemas
 * Used by Payment modal, submission hook, createInvoiceAction, processPayment, delete-order.
 * Single source of truth for validation and types.
 */

import { z } from 'zod';
import { PAYMENT_METHODS, normalizePaymentMethodCode } from '@/lib/constants/order-types';
import { validateCheckDueDate } from '@/lib/utils/check-date';

export const OUTSTANDING_POLICIES = {
  NONE: 'NONE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  CREDIT_INVOICE: 'CREDIT_INVOICE',
} as const;

export type OutstandingPolicy =
  (typeof OUTSTANDING_POLICIES)[keyof typeof OUTSTANDING_POLICIES];

export const outstandingPolicySchema = z.enum([
  OUTSTANDING_POLICIES.NONE,
  OUTSTANDING_POLICIES.PAY_ON_COLLECTION,
  OUTSTANDING_POLICIES.CREDIT_INVOICE,
]);

/**
 * Coerces optional UUID JSON fields to undefined when absent, blank, non-string,
 * or not a valid UUID (avoids Zod "Invalid uuid" / "Invalid input" on unused promo/gift fields).
 */
const OPTIONAL_FIELD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuidJsonPreprocess(val: unknown): unknown {
  if (val === '' || val == null) return undefined;
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (trimmed === '') return undefined;
  if (!OPTIONAL_FIELD_UUID_RE.test(trimmed)) return undefined;
  return trimmed;
}

const canonicalPaymentMethodCodeSchema = z.enum([
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.CHECK,
  PAYMENT_METHODS.PAY_ON_COLLECTION,
  PAYMENT_METHODS.INVOICE,
  PAYMENT_METHODS.HYPERPAY,
  PAYMENT_METHODS.PAYTABS,
  PAYMENT_METHODS.STRIPE,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.MOBILE_PAYMENT,
  'WALLET',
  'CUSTOMER_CREDIT',
  'CUSTOMER_ADVANCE',
  'LOYALTY_CREDIT',
]);

// Payment method codes (server/action side – uppercase)
const paymentMethodCodeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizePaymentMethodCode(value) : value),
  canonicalPaymentMethodCodeSchema
);

// ---------------------------------------------------------------------------
// Payment leg (one leg in a multi-leg split payment)
// ---------------------------------------------------------------------------

/**
 * A single settlement leg in the order payment flow.
 * Real-payment and customer-credit legs can be mixed, but deferred methods must remain isolated.
 */
export const paymentLegSchema = z
  .object({
    /** Payment method code for this leg (must match paymentMethodCodeSchema) */
    method: paymentMethodCodeSchema,
    /** Positive amount for this leg */
    amount: z.number().positive(),
    /** Check number — required when method is CHECK */
    checkNumber: z.string().optional(),
    /** Issuing bank for check payments */
    checkBank: z.string().optional(),
    /** Check date (ISO date string) */
    checkDate: z.string().optional(),
    /** Cash tendered by customer (only for CASH legs — used to compute change returned) */
    cashTendered: z.number().min(0).optional(),
    /** Card brand code — for CARD legs (references org_card_brand_cf.card_brand_code) */
    card_brand_code: z.string().optional(),
    /** Last 4 digits of card — for CARD legs (PCI: never store full PAN) */
    card_last4: z.string().max(4).optional(),
    /** Authorization code from terminal/gateway — for CARD legs */
    auth_code: z.string().optional(),
    /** Bank transfer reference number — for BANK_TRANSFER legs */
    bank_reference: z.string().optional(),
    /** Payment gateway code — for gateway legs (HYPERPAY / PAYTABS / STRIPE) */
    gateway_code: z.string().optional(),
    /** Gateway transaction identifier */
    gateway_transaction_id: z.string().optional(),
    /** Gateway reference string */
    gateway_reference: z.string().optional(),
    /** Credit-note / source reference for stored-value legs that require a specific document. */
    creditReferenceId: z.string().uuid().optional(),
    /**
     * BVM Phase 6 Sub-item 6 (Phase-1B B7 closer): explicit per-leg payment
     * status. The field is optional — when omitted, the planner / settle
     * path runs the existing gateway-driven PENDING fallback, which mirrors
     * the pre-Phase-6 behaviour exactly. Passing `'PENDING'` explicitly
     * forces the leg to PENDING regardless of gateway routing.
     *
     * The default is left implicit (omission ≡ COMPLETED fallback) so the
     * Zod `.infer` shape stays optional and the dozens of existing
     * paymentLegs literals at call sites continue to compile.
     */
    paymentStatus: z.enum(['COMPLETED', 'PENDING']).optional(),
  })
  .superRefine((leg, ctx) => {
    // BVM Phase 6 Sub-item 6: server-side enforcement of the CHECK due-date
    // rule that lives in the modal helper. The same `validateCheckDueDate`
    // function powers the client error, so client + server stay in lockstep.
    if (leg.method !== PAYMENT_METHODS.CHECK || !leg.checkDate) return;
    const reason = validateCheckDueDate(leg.checkDate);
    if (reason) {
      ctx.addIssue({
        // i18n key suffix — message matches keys under `orders.new.splitPayment.*`
        code: z.ZodIssueCode.custom,
        message: reason,
        path: ['checkDate'],
      });
    }
  });

export type PaymentLeg = z.infer<typeof paymentLegSchema>;

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
    outstandingPolicy: outstandingPolicySchema.optional(),
    currencyCode: z.string().length(3).optional(),
    currencyExRate: z.number().min(0).optional(),
    /** B2B: When true, admin overrides credit limit (warn mode). Passed to create-with-payment. */
    creditLimitOverride: z.boolean().optional(),
    /** OPEN cash-drawer session chosen for any cash-taking legs in this checkout. */
    cashDrawerSessionId: z.string().uuid().optional(),
    /** Selected tax profile IDs shown in the payment modal tax panel. */
    taxProfileIds: z.array(z.string().uuid()).optional(),
    /** Split-payment legs. When provided, each leg amount must be > 0 and the sum must equal finalTotal. */
    paymentLegs: z.array(paymentLegSchema).optional(),
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
      /** Service preference surcharge for the line. Included in subtotal. */
      servicePrefCharge: z.number().min(0).optional(),
      /** Packing surcharge for the line (`org_packing_preference_cf.extra_price` roll-up). Included in subtotal. */
      packingPrefCharge: z.number().min(0).optional(),
    })
  ).min(1),
  branchId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ).optional(),
  customerId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ).optional(),
  isExpress: z.boolean().optional(),
  percentDiscount: z.number().min(0).max(100).optional(),
  amountDiscount: z.number().min(0).optional(),
  serviceCategories: z.array(z.string()).optional(),
  taxProfileIds: z.array(z.string().uuid()).optional(),
  promoCode: z.string().optional(),
  giftCardNumber: z.string().optional(),
  giftCardAmount: z.number().min(0).optional(),
  giftCardId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
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
  /** Canonical tax profile selection used by web-admin and external clients. */
  taxProfileIds: z.array(z.string().uuid()).optional(),
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
        colorCodes: z.array(z.string()).optional(),
        colorCfIds: z.array(z.union([z.string().uuid(), z.null()])).optional(),
        brand: z.string().optional(),
        hasStain: z.boolean().optional(),
        hasDamage: z.boolean().optional(),
        notes: z.string().optional(),
        rackLocation: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        conditions: z.array(z.string()).optional(),
        servicePrefs: z.array(z.object({
          preference_code: z.string(),
          source: z.string(),
          extra_price: z.number().nonnegative(),
          preferenceCfId: z.string().uuid().optional().nullable(),
        })).optional(),
        packingPrefCode: z.string().optional(),
        packingCfId: z.string().uuid().optional().nullable(),
      })).optional(),
      servicePrefs: z.array(z.object({
        preference_code: z.string(),
        source: z.string(),
        extra_price: z.number().nonnegative(),
        preferenceCfId: z.string().uuid().optional().nullable(),
      })).optional(),
      packingPrefCode: z.string().optional(),
      packingPrefIsOverride: z.boolean().optional(),
      packingPrefSource: z.string().optional(),
      packingCfId: z.string().uuid().optional().nullable(),
      servicePrefCharge: z.number().min(0).optional(),
      packingPrefCharge: z.number().min(0).optional(),
    })
  ).min(1),
  isQuickDrop: z.boolean().optional(),
  quickDropQuantity: z.number().positive().optional(),
  express: z.boolean().optional(),
  customerNotes: z.string().optional(),
  paymentNotes: z.string().optional(),
  readyByAt: z.string().datetime().optional(),
  paymentMethod: paymentMethodCodeSchema,
  percentDiscount: z.number().min(0).max(100).optional(),
  amountDiscount: z.number().min(0).optional(),
  promoCode: z.string().optional(),
  promoCodeId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
  promoDiscount: z.number().min(0).optional(),
  giftCardNumber: z.string().optional(),
  giftCardAmount: z.number().min(0).optional(),
  giftCardId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
  checkNumber: z.string().optional(),
  checkBank: z.string().optional(),
  checkDate: z.string().optional(),
  branchId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().optional() // z.string().uuid().optional()
  ).optional(),
  /** Customer snapshot at order time (order-level, not customer master) */
  customerMobile: z.string().max(50).optional(),
  customerEmail: z.string().max(255).optional(),
  customerName: z.string().max(255).optional(),
  isDefaultCustomer: z.boolean().optional(),
  customerDetails: z.record(z.string(), z.unknown()).optional(),
  /** B2B: Contract, cost center, PO */
  b2bContractId: z.string().uuid().optional(),
  costCenterCode: z.string().max(50).optional(),
  poNumber: z.string().max(100).optional(),
  /** B2B: When true, admin overrides credit limit (warn mode). Recorded on order for audit. */
  creditLimitOverride: z.boolean().optional(),
  /** Client-generated UUID for idempotent retry — server returns existing order if key is seen again. */
  idempotencyKey: z.string().max(100).optional(),
  /** Cash drawer session ID — required when a CASH payment method has requiresCashDrawer=true. */
  cashDrawerSessionId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
  clientTotals: clientTotalsSchema,
  /** Amount to charge now (for partial payment). Defaults to clientTotals.finalTotal. Must be <= finalTotal. */
  amountToCharge: z.number().min(0).optional(),
  /**
   * Explicit outstanding balance disposition for any unpaid remainder after
   * immediate settlement. Deferred remainder is modeled here instead of being
   * mixed into paymentLegs.
   */
  outstandingPolicy: outstandingPolicySchema.optional(),
  /**
   * Split-payment legs. When provided and non-empty, the route processes each leg individually.
   * Omit (or pass undefined) for single-leg behaviour (backward-compatible).
   */
  paymentLegs: z.array(paymentLegSchema).min(1).optional(),
});

export type CreateWithPaymentRequest = z.infer<typeof createWithPaymentRequestSchema>;
export type ClientTotals = z.infer<typeof clientTotalsSchema>;

// ---------------------------------------------------------------------------
// Submit Order API input — canonical replacement for create-with-payment
// ---------------------------------------------------------------------------

/**
 * Input schema for POST /api/v1/orders/submit-order — the canonical order
 * submission path (Phase 1B+).
 *
 * Extends createWithPaymentRequestSchema with one key difference:
 * `idempotencyKey` is REQUIRED here (min length 1), whereas the base schema
 * treats it as optional. This is intentional — the submit-order route owns
 * the full idempotency lifecycle (D11 design) and must always receive a
 * client-generated key to enable safe retry semantics.
 *
 * All other fields are inherited from createWithPaymentRequestSchema without
 * modification — this schema must remain a strict superset so callers that
 * already build a CreateWithPaymentRequest only need to add the key.
 *
 * @example
 * const result = submitOrderRequestSchema.safeParse({
 *   ...createWithPaymentPayload,
 *   idempotencyKey: crypto.randomUUID(),
 * });
 */
export const submitOrderRequestSchema = createWithPaymentRequestSchema.extend({
  idempotencyKey: z.string().min(1, 'idempotencyKey is required on submit-order'),
});

/**
 * TypeScript type derived from submitOrderRequestSchema.
 * Use this type for the `input` parameter in the orchestrator and the route handler.
 * The only guarantee over CreateWithPaymentRequest is that `idempotencyKey` is
 * `string` (never `undefined`).
 */
export type SubmitOrderRequest = z.infer<typeof submitOrderRequestSchema>;

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
    promoCodeId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
    giftCardNumber: z.string().optional(),
    giftCardAmount: z.number().min(0).optional(),
    giftCardId: z.preprocess(optionalUuidJsonPreprocess, z.string().uuid().optional()).optional(),
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
