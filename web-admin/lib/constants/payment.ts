/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * Payment Constants — Single source of truth for payment kinds and method codes.
 * Used by lib/types/payment.ts and lib/constants/order-types.ts.
 *
 * For new financial platform constants (charge types, tax types, credit application
 * types, loyalty, outbox, reconciliation) see lib/constants/order-financial.ts.
 */

export { LOYALTY_TXN_TYPES } from '@/lib/constants/order-financial';
export type { LoyaltyTxnType } from '@/lib/constants/order-financial';
import {
  AR_INVOICE_STATUSES,
  type ArInvoiceStatus,
  type LegacyInvoiceStatus,
} from '@/lib/constants/ar-invoice';

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
// GIFT_CARD is a CREDIT_APPLICATION type, not a payment method — see CREDIT_APPLICATION_TYPES in order-financial.ts
// PROMO_CODE is a discount source, never a settlement option — removed to prevent misuse
export const PAYMENT_METHODS = {
  CASH:           'CASH',
  CARD:           'CARD',
  CHECK:          'CHECK',
  INVOICE:        'CREDIT_INVOICE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY: 'PAY_ON_DELIVERY',
  BANK_TRANSFER:  'BANK_TRANSFER',
  MOBILE_PAYMENT: 'MOBILE_PAYMENT',
  PAYMENT_GATEWAY: 'PAYMENT_GATEWAY',
  HYPERPAY:       'HYPERPAY',
  PAYTABS:        'PAYTABS',
  STRIPE:         'STRIPE',
} as const;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * Legacy client aliases that still appear in older payloads and cached UI state.
 *
 * The database stores `CREDIT_INVOICE`, so every server-side boundary must
 * normalize `INVOICE` before validation, config lookup, or persistence.
 */
const LEGACY_PAYMENT_METHOD_ALIASES = {
  INVOICE: PAYMENT_METHODS.INVOICE,
  HYPERPAY: PAYMENT_METHODS.PAYMENT_GATEWAY,
  PAYTABS: PAYMENT_METHODS.PAYMENT_GATEWAY,
  STRIPE: PAYMENT_METHODS.PAYMENT_GATEWAY,
} as const;

/**
 * Normalizes inbound payment method codes to their canonical DB/API value.
 *
 * @param method Raw payment method code from UI state, URL params, or older clients.
 * @returns Canonical payment method code, or the original input when no alias exists.
 */
export function normalizePaymentMethodCode<T extends string | null | undefined>(method: T): T | PaymentMethodCode {
  if (method == null) {
    return method;
  }

  return (LEGACY_PAYMENT_METHOD_ALIASES[method as keyof typeof LEGACY_PAYMENT_METHOD_ALIASES] ??
    method) as T | PaymentMethodCode;
}

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
 * Invoice status values.
 *
 * The uppercase values are the canonical AR Invoice v1 DB codes.
 * `PENDING` and `PARTIAL` remain as compatibility aliases for older callers.
 */
export const INVOICE_STATUSES = {
  ...AR_INVOICE_STATUSES,
  PENDING: AR_INVOICE_STATUSES.OPEN,
  PARTIAL: AR_INVOICE_STATUSES.PARTIALLY_PAID,
} as const;

export type InvoiceStatus =
  | (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES]
  | LegacyInvoiceStatus
  | ArInvoiceStatus;

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

// =============================================================================
// V1 Payment Config Client Layer — new constants
// =============================================================================

export const PAYMENT_NATURE = {
  REAL_PAYMENT:          'REAL_PAYMENT',
  CREDIT_APPLICATION:    'CREDIT_APPLICATION',
  AR_ALLOCATION:         'AR_ALLOCATION',
  DEFERRED_SETTLEMENT:   'DEFERRED_SETTLEMENT',
  INTERNAL_ADJUSTMENT:   'INTERNAL_ADJUSTMENT',
} as const;
export type PaymentNature = (typeof PAYMENT_NATURE)[keyof typeof PAYMENT_NATURE];

export const FEE_TYPES = {
  NONE:       'NONE',
  FIXED:      'FIXED',
  PERCENTAGE: 'PERCENTAGE',
} as const;
export type FeeType = (typeof FEE_TYPES)[keyof typeof FEE_TYPES];

export const TERMINAL_TYPES = {
  POS_CARD_TERMINAL: 'POS_CARD_TERMINAL',
  CASH_DRAWER:       'CASH_DRAWER',
  ONLINE_GATEWAY:    'ONLINE_GATEWAY',
  BANK_DEVICE:       'BANK_DEVICE',
  OTHER:             'OTHER',
} as const;
export type TerminalType = (typeof TERMINAL_TYPES)[keyof typeof TERMINAL_TYPES];

export const DRAWER_TYPES = {
  COUNTER:    'COUNTER',
  SAFE:       'SAFE',
  DRIVER_BAG: 'DRIVER_BAG',
  TEMPORARY:  'TEMPORARY',
} as const;
export type DrawerType = (typeof DRAWER_TYPES)[keyof typeof DRAWER_TYPES];

export const CASH_DRAWER_SESSION_STATUSES = {
  OPEN:        'OPEN',
  CLOSED:      'CLOSED',
  FORCE_CLOSED:'FORCE_CLOSED',
  CANCELLED:   'CANCELLED',
} as const;
export type CashDrawerSessionStatus = (typeof CASH_DRAWER_SESSION_STATUSES)[keyof typeof CASH_DRAWER_SESSION_STATUSES];

export const CASH_DRAWER_MOVEMENT_TYPES = {
  OPENING_FLOAT:  'OPENING_FLOAT',
  CASH_SALE:      'CASH_SALE',
  CASH_REFUND:    'CASH_REFUND',
  CASH_IN:        'CASH_IN',
  CASH_OUT:       'CASH_OUT',
  CASH_DROP:      'CASH_DROP',
  CLOSING_COUNT:  'CLOSING_COUNT',
  SHORTAGE:       'SHORTAGE',
  OVERAGE:        'OVERAGE',
  ADJUSTMENT:     'ADJUSTMENT',
} as const;
export type CashDrawerMovementType = (typeof CASH_DRAWER_MOVEMENT_TYPES)[keyof typeof CASH_DRAWER_MOVEMENT_TYPES];

export const MOVEMENT_DIRECTIONS = {
  IN:   'IN',
  OUT:  'OUT',
  NONE: 'NONE',
} as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[keyof typeof MOVEMENT_DIRECTIONS];

export const CREDIT_TYPES = {
  GIFT_CARD:        'GIFT_CARD',
  WALLET:           'WALLET',
  ADVANCE:          'ADVANCE',
  CREDIT_NOTE:      'CREDIT_NOTE',
  LOYALTY_POINTS:   'LOYALTY_POINTS',
  CUSTOMER_CREDIT:  'CREDIT_NOTE',
  LOYALTY_CREDIT:   'LOYALTY_POINTS',
  CUSTOMER_ADVANCE: 'ADVANCE',
} as const;
export type CreditType = (typeof CREDIT_TYPES)[keyof typeof CREDIT_TYPES];

export const ORDER_PAYMENT_STATUSES = {
  PENDING:   'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED:  'REFUNDED',
} as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[keyof typeof ORDER_PAYMENT_STATUSES];

export const REFUND_STATUSES = {
  PENDING:   'PENDING',
  APPROVED:  'APPROVED',
  PROCESSED: 'PROCESSED',
  FAILED:    'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];

/** Map payment method to payment type code (sys_payment_type_cd) for order/payment records */
export function getPaymentTypeFromMethod(method: string): PaymentTypeId | undefined {
  switch (normalizePaymentMethodCode(method)) {
    case PAYMENT_METHODS.CASH:
    case PAYMENT_METHODS.CARD:
    case PAYMENT_METHODS.CHECK:
    case PAYMENT_METHODS.BANK_TRANSFER:
    case PAYMENT_METHODS.MOBILE_PAYMENT:
    case PAYMENT_METHODS.PAYMENT_GATEWAY:
      return PAYMENT_TYPE_IDS.PAY_IN_ADVANCE;
    case PAYMENT_METHODS.PAY_ON_COLLECTION:
      return PAYMENT_TYPE_IDS.PAY_ON_COLLECTION;
    case PAYMENT_METHODS.INVOICE:
      return PAYMENT_TYPE_IDS.CREDIT_INVOICE;//PAY_ON_COLLECTION;
    default:
      return undefined;
  }
}

/** Map explicit outstanding-policy selection to order payment_type_code. */
export function getPaymentTypeFromOutstandingPolicy(
  policy: 'NONE' | 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE'
): PaymentTypeId | undefined {
  switch (policy) {
    case 'PAY_ON_COLLECTION':
      return PAYMENT_TYPE_IDS.PAY_ON_COLLECTION;
    case 'CREDIT_INVOICE':
      return PAYMENT_TYPE_IDS.CREDIT_INVOICE;
    default:
      return PAYMENT_TYPE_IDS.PAY_IN_ADVANCE;
  }
}
