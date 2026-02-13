/**
 * Payment Constants — Single source of truth for payment kinds and method codes.
 * Used by lib/types/payment.ts and lib/constants/order-types.ts.
 */

/**
 * Payment Kind IDs (invoice, deposit, advance, pos, normal)
 */
export const PAYMENT_KINDS = {
  NORMAL: 'normal',
  INVOICE: 'invoice',
  DEPOSIT: 'deposit',
  ADVANCE: 'advance',
  POS: 'pos',
} as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[keyof typeof PAYMENT_KINDS];

/**
 * Payment Method Codes (DB/API codes)
 */
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  CHECK: 'CHECK',
  INVOICE: 'INVOICE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  GIFT_CARD: 'GIFT_CARD',
  PROMO_CODE: 'PROMO_CODE',
  HYPERPAY: 'HYPERPAY',
  PAYTABS: 'PAYTABS',
  STRIPE: 'STRIPE',
} as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * Payment Type IDs (sys_payment_type_cd: PAY_IN_ADVANCE, PAY_ON_COLLECTION, etc.)
 */
export const PAYMENT_TYPE_IDS = {
  PAY_IN_ADVANCE: 'PAY_IN_ADVANCE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY: 'PAY_ON_DELIVERY',
  CREDIT_INVOICE: 'CREDIT_INVOICE',
} as const;

export type PaymentTypeId = (typeof PAYMENT_TYPE_IDS)[keyof typeof PAYMENT_TYPE_IDS];

/**
 * Invoice status values
 */
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

/**
 * Payment transaction status (per-transaction lifecycle)
 */
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

/**
 * Payment gateway identifiers
 */
export const PAYMENT_GATEWAYS = {
  HYPERPAY: 'hyperpay',
  PAYTABS: 'paytabs',
  STRIPE: 'stripe',
  MANUAL: 'manual',
} as const;

export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[keyof typeof PAYMENT_GATEWAYS] | null;

/** Map payment method to payment type code (sys_payment_type_cd) for order/payment records */
export function getPaymentTypeFromMethod(method: string): PaymentTypeId | undefined {
  switch (method) {
    case PAYMENT_METHODS.CASH:
    case PAYMENT_METHODS.CARD:
    case PAYMENT_METHODS.CHECK:
    case PAYMENT_METHODS.BANK_TRANSFER:
    case PAYMENT_METHODS.MOBILE_PAYMENT:
    case PAYMENT_METHODS.HYPERPAY:
    case PAYMENT_METHODS.PAYTABS:
    case PAYMENT_METHODS.STRIPE:
      return PAYMENT_TYPE_IDS.PAY_IN_ADVANCE;
    case PAYMENT_METHODS.PAY_ON_COLLECTION:
      return PAYMENT_TYPE_IDS.PAY_ON_COLLECTION;
    case PAYMENT_METHODS.INVOICE:
      return PAYMENT_TYPE_IDS.CREDIT_INVOICE;//PAY_ON_COLLECTION;
    default:
      return undefined;
  }
}
