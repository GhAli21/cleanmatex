/**
 * Order Financial Platform — Constants
 * Single source of truth for all financial domain constants.
 * Values mirror exact DB check-constraint strings and lookup-table PKs.
 */

// ── Charge types (org_order_charges_dtl.charge_type) ─────────────────────────
export const CHARGE_TYPES = {
  PREFERENCE:       'PREFERENCE',
  EXPRESS:          'EXPRESS',
  BULK_SURCHARGE:   'BULK_SURCHARGE',
  SPECIAL_HANDLING: 'SPECIAL_HANDLING',
} as const;
export type ChargeType = (typeof CHARGE_TYPES)[keyof typeof CHARGE_TYPES];

// ── Tax types (org_order_taxes_dtl.tax_type) ──────────────────────────────────
export const TAX_TYPES = {
  VAT:    'VAT',
  GST:    'GST',
  CUSTOM: 'CUSTOM',
} as const;
export type TaxType = (typeof TAX_TYPES)[keyof typeof TAX_TYPES];

// ── Credit application types (org_order_credit_apps_dtl.credit_type) ─────────
// CREDIT_NOTE is the only document-based credit in V1; CUSTOMER_CREDIT is out of scope.
export const CREDIT_APPLICATION_TYPES = {
  GIFT_CARD:      'GIFT_CARD',
  WALLET:         'WALLET',
  ADVANCE:        'ADVANCE',
  CREDIT_NOTE:    'CREDIT_NOTE',
  LOYALTY_POINTS: 'LOYALTY_POINTS',
} as const;
export type CreditApplicationType = (typeof CREDIT_APPLICATION_TYPES)[keyof typeof CREDIT_APPLICATION_TYPES];

// ── Refund reason codes (sys_refund_reason_codes_cd.reason_code) ──────────────
export const REFUND_REASON_CODES = {
  DUPLICATE:  'DUPLICATE',
  QUALITY:    'QUALITY',
  CANCELLED:  'CANCELLED',
  OVERCHARGE: 'OVERCHARGE',
  OTHER:      'OTHER',
} as const;
export type RefundReasonCode = (typeof REFUND_REASON_CODES)[keyof typeof REFUND_REASON_CODES];

// ── Refund methods (sys_refund_methods_cd.refund_method) ─────────────────────
export const REFUND_METHODS = {
  ORIGINAL_METHOD: 'ORIGINAL_METHOD',
  CASH:            'CASH',
  CREDIT_NOTE:     'CREDIT_NOTE',
  WALLET:          'WALLET',
} as const;
export type RefundMethod = (typeof REFUND_METHODS)[keyof typeof REFUND_METHODS];

// ── Stored-value transaction types ────────────────────────────────────────────
// Used by wallet, advance, and credit-note ledger tables.
export const STORED_VALUE_TXN_TYPES = {
  TOP_UP:     'TOP_UP',
  REDEMPTION: 'REDEMPTION',
  REFUND:     'REFUND',
  EXPIRY:     'EXPIRY',
  CORRECTION: 'CORRECTION',
  ISSUE:      'ISSUE',
} as const;
export type StoredValueTxnType = (typeof STORED_VALUE_TXN_TYPES)[keyof typeof STORED_VALUE_TXN_TYPES];

// ── Promotion types (org_promotions_mst.promo_type) ───────────────────────────
export const PROMO_TYPES = {
  PERCENTAGE:   'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  BUY_X_GET_Y:  'BUY_X_GET_Y',
  FREE_ITEM:    'FREE_ITEM',
} as const;
export type PromoType = (typeof PROMO_TYPES)[keyof typeof PROMO_TYPES];

// ── Reconciliation check names ────────────────────────────────────────────────
export const RECONCILIATION_CHECK_NAMES = {
  PAYMENT_TOTAL_MATCH:   'PAYMENT_TOTAL_MATCH',
  CREDIT_APP_BALANCE:    'CREDIT_APP_BALANCE',
  OUTSTANDING_TOTAL_MATCH: 'OUTSTANDING_TOTAL_MATCH',
  STORED_VALUE_LEDGER:   'STORED_VALUE_LEDGER',
  GATEWAY_PENDING_INTEGRITY: 'GATEWAY_PENDING_INTEGRITY',
  LEGACY_STATUS_LEAKAGE: 'LEGACY_STATUS_LEAKAGE',
  TAX_CALCULATION:       'TAX_CALCULATION',
  DISCOUNT_VALIDATION:   'DISCOUNT_VALIDATION',
  REFUND_CONSISTENCY:    'REFUND_CONSISTENCY',
  OUTBOX_PROCESSED:      'OUTBOX_PROCESSED',
} as const;
export type ReconciliationCheckName = (typeof RECONCILIATION_CHECK_NAMES)[keyof typeof RECONCILIATION_CHECK_NAMES];

// ── Reconciliation severity ───────────────────────────────────────────────────
export const RECONCILIATION_SEVERITIES = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO:    'INFO',
} as const;
export type ReconciliationSeverity = (typeof RECONCILIATION_SEVERITIES)[keyof typeof RECONCILIATION_SEVERITIES];

// ── Reconciliation run statuses ───────────────────────────────────────────────
export const RECONCILIATION_RUN_STATUSES = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED:  'PASSED',
  FAILED:  'FAILED',
  PARTIAL: 'PARTIAL',
} as const;
export type ReconciliationRunStatus = (typeof RECONCILIATION_RUN_STATUSES)[keyof typeof RECONCILIATION_RUN_STATUSES];

// ── Domain outbox event types ─────────────────────────────────────────────────
export const OUTBOX_EVENT_TYPES = {
  ORDER_COMPLETED:      'ORDER_COMPLETED',
  PAYMENT_RECEIVED:     'PAYMENT_RECEIVED',
  REFUND_PROCESSED:     'REFUND_PROCESSED',
  ORDER_FINANCIAL_ADJUSTMENT_CREATED: 'ORDER_FINANCIAL_ADJUSTMENT_CREATED',
  LOYALTY_EARN:         'LOYALTY_EARN',
  STORED_VALUE_CHANGED: 'STORED_VALUE_CHANGED',
  GIFT_CARD_REDEEMED:   'GIFT_CARD_REDEEMED',
} as const;
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

// ── Outbox processing statuses ────────────────────────────────────────────────
export const OUTBOX_STATUSES = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED:  'PROCESSED',
  FAILED:     'FAILED',
} as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[keyof typeof OUTBOX_STATUSES];

// ── Checkout settlement routing — mirrors org_payment_methods_cf.payment_nature ─
// Defined here to avoid import from payment.ts which has its own PAYMENT_NATURE.
// These values must match the sys_payment_method_cd.payment_nature check constraint.
export const PAYMENT_NATURE = {
  REAL_PAYMENT:        'REAL_PAYMENT',
  CREDIT_APPLICATION:  'CREDIT_APPLICATION',
  DEFERRED_SETTLEMENT: 'DEFERRED_SETTLEMENT',
  AR_ALLOCATION:       'AR_ALLOCATION',
  INTERNAL_ADJUSTMENT: 'INTERNAL_ADJUSTMENT',
} as const;
export type PaymentNature = (typeof PAYMENT_NATURE)[keyof typeof PAYMENT_NATURE];

// ── Settlement type codes — mirrors sys_payment_type_cd.payment_type_code ─────
export const SETTLEMENT_TYPE_CODES = {
  PAY_IN_ADVANCE:    'PAY_IN_ADVANCE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY:   'PAY_ON_DELIVERY',
  CREDIT_INVOICE:    'CREDIT_INVOICE',
} as const;
export type SettlementTypeCode = (typeof SETTLEMENT_TYPE_CODES)[keyof typeof SETTLEMENT_TYPE_CODES];

// ── Order payment status (org_orders_mst.payment_status snapshot) ─────────────
export const ORDER_PAYMENT_STATUS = {
  PENDING:             'PENDING',             // default — order created, not yet settled
  UNPAID:              'UNPAID',
  PENDING_COLLECTION:  'PENDING_COLLECTION',
  PARTIALLY_PAID:      'PARTIALLY_PAID',
  PAID:                'PAID',
  OVERPAID:            'OVERPAID',
  REFUNDED:            'REFUNDED',
  PARTIALLY_REFUNDED:  'PARTIALLY_REFUNDED',
} as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];

// ── Loyalty transaction types (org_loyalty_txn_dtl.txn_type) ─────────────────
export const LOYALTY_TXN_TYPES = {
  EARN:   'EARN',
  REDEEM: 'REDEEM',
  EXPIRE: 'EXPIRE',
  ADJUST: 'ADJUST',
  BONUS:  'BONUS',
} as const;
export type LoyaltyTxnType = (typeof LOYALTY_TXN_TYPES)[keyof typeof LOYALTY_TXN_TYPES];

// ── Credit note statuses (org_credit_notes_mst.status) ───────────────────────
export const CREDIT_NOTE_STATUSES = {
  ACTIVE:    'ACTIVE',
  EXHAUSTED: 'EXHAUSTED',
  EXPIRED:   'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[keyof typeof CREDIT_NOTE_STATUSES];
