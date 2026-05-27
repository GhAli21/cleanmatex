/**
 * Order Financial Platform constants.
 *
 * Why:
 * This file is the single source of truth for Order Fin values that round-trip
 * to the database, reconciliation jobs, and finance UI. Keeping them here
 * prevents string drift across routes, services, and reports.
 */

/** Charge fact codes persisted in `org_order_charges_dtl.charge_type`. */
export const CHARGE_TYPES = {
  PREFERENCE: 'PREFERENCE',
  EXPRESS: 'EXPRESS',
  BULK_SURCHARGE: 'BULK_SURCHARGE',
  SPECIAL_HANDLING: 'SPECIAL_HANDLING',
} as const;
/** Derived union for persisted order charge codes. */
export type ChargeType = (typeof CHARGE_TYPES)[keyof typeof CHARGE_TYPES];

/** Tax fact codes persisted in `org_order_taxes_dtl.tax_type`. */
export const TAX_TYPES = {
  VAT: 'VAT',
  GST: 'GST',
  CUSTOM: 'CUSTOM',
} as const;
/** Derived union for persisted order tax codes. */
export type TaxType = (typeof TAX_TYPES)[keyof typeof TAX_TYPES];

/**
 * Stored-value application codes persisted in `org_order_credit_apps_dtl.credit_type`.
 *
 * Why:
 * Batch 0 keeps credit applications distinct from commercial discounts and
 * real payment legs.
 */
export const CREDIT_APPLICATION_TYPES = {
  GIFT_CARD:        'GIFT_CARD',
  WALLET:           'WALLET',
  CUSTOMER_CREDIT:  'CUSTOMER_CREDIT',
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  LOYALTY_CREDIT:   'LOYALTY_CREDIT',
} as const;
/** Derived union for stored-value application codes. */
export type CreditApplicationType =
  (typeof CREDIT_APPLICATION_TYPES)[keyof typeof CREDIT_APPLICATION_TYPES];

/** Refund reason codes mirrored from `sys_refund_reason_codes_cd.reason_code`. */
export const REFUND_REASON_CODES = {
  DUPLICATE: 'DUPLICATE',
  QUALITY: 'QUALITY',
  CANCELLED: 'CANCELLED',
  OVERCHARGE: 'OVERCHARGE',
  OTHER: 'OTHER',
} as const;
/** Derived union for refund reason codes. */
export type RefundReasonCode =
  (typeof REFUND_REASON_CODES)[keyof typeof REFUND_REASON_CODES];

/** Refund payout methods mirrored from `sys_refund_methods_cd.refund_method`. */
export const REFUND_METHODS = {
  ORIGINAL_METHOD: 'ORIGINAL_METHOD',
  CASH: 'CASH',
  CREDIT_NOTE: 'CREDIT_NOTE',
  WALLET: 'WALLET',
} as const;
/** Derived union for refund payout methods. */
export type RefundMethod = (typeof REFUND_METHODS)[keyof typeof REFUND_METHODS];

/** Stored-value ledger transaction types used by wallet, advance, and credit-note flows. */
export const STORED_VALUE_TXN_TYPES = {
  TOP_UP: 'TOP_UP',
  REDEMPTION: 'REDEMPTION',
  REFUND: 'REFUND',
  EXPIRY: 'EXPIRY',
  CORRECTION: 'CORRECTION',
  ISSUE: 'ISSUE',
} as const;
/** Derived union for stored-value ledger transaction types. */
export type StoredValueTxnType =
  (typeof STORED_VALUE_TXN_TYPES)[keyof typeof STORED_VALUE_TXN_TYPES];

/** Promotion type codes mirrored from `org_promotions_mst.promo_type`. */
export const PROMO_TYPES = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  BUY_X_GET_Y: 'BUY_X_GET_Y',
  FREE_ITEM: 'FREE_ITEM',
} as const;
/** Derived union for promotion type codes. */
export type PromoType = (typeof PROMO_TYPES)[keyof typeof PROMO_TYPES];

/** Reconciliation check identifiers written to issue rows and reports. */
export const RECONCILIATION_CHECK_NAMES = {
  PAYMENT_TOTAL_MATCH: 'PAYMENT_TOTAL_MATCH',
  CREDIT_APP_BALANCE: 'CREDIT_APP_BALANCE',
  OUTSTANDING_TOTAL_MATCH: 'OUTSTANDING_TOTAL_MATCH',
  STORED_VALUE_LEDGER: 'STORED_VALUE_LEDGER',
  GATEWAY_PENDING_INTEGRITY: 'GATEWAY_PENDING_INTEGRITY',
  LEGACY_STATUS_LEAKAGE: 'LEGACY_STATUS_LEAKAGE',
  TAX_CALCULATION: 'TAX_CALCULATION',
  DISCOUNT_VALIDATION: 'DISCOUNT_VALIDATION',
  REFUND_CONSISTENCY: 'REFUND_CONSISTENCY',
  OUTBOX_PROCESSED: 'OUTBOX_PROCESSED',
} as const;
/** Derived union for reconciliation check identifiers. */
export type ReconciliationCheckName =
  (typeof RECONCILIATION_CHECK_NAMES)[keyof typeof RECONCILIATION_CHECK_NAMES];

/** Reconciliation issue severities persisted in finance reconciliation rows. */
export const RECONCILIATION_SEVERITIES = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;
/** Derived union for reconciliation issue severities. */
export type ReconciliationSeverity =
  (typeof RECONCILIATION_SEVERITIES)[keyof typeof RECONCILIATION_SEVERITIES];

/** Finance reconciliation run statuses mirrored from the persisted run header. */
export const RECONCILIATION_RUN_STATUSES = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
} as const;
/** Derived union for reconciliation run states. */
export type ReconciliationRunStatus =
  (typeof RECONCILIATION_RUN_STATUSES)[keyof typeof RECONCILIATION_RUN_STATUSES];

/** Domain outbox event names emitted by Order Fin write paths. */
export const OUTBOX_EVENT_TYPES = {
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
  ORDER_FINANCIAL_ADJUSTMENT_CREATED: 'ORDER_FINANCIAL_ADJUSTMENT_CREATED',
  LOYALTY_EARN: 'LOYALTY_EARN',
  STORED_VALUE_CHANGED: 'STORED_VALUE_CHANGED',
  GIFT_CARD_REDEEMED: 'GIFT_CARD_REDEEMED',
  AR_INVOICE_ISSUED: 'AR_INVOICE_ISSUED',
  AR_PAYMENT_ALLOCATED: 'AR_PAYMENT_ALLOCATED',
  AR_PAYMENT_ALLOCATION_REVERSED: 'AR_PAYMENT_ALLOCATION_REVERSED',
  AR_OVERPAYMENT_CREDIT_CREATED: 'AR_OVERPAYMENT_CREDIT_CREATED',
  AR_CREDIT_MEMO_POSTED: 'AR_CREDIT_MEMO_POSTED',
  AR_DEBIT_NOTE_POSTED: 'AR_DEBIT_NOTE_POSTED',
  AR_WRITE_OFF_POSTED: 'AR_WRITE_OFF_POSTED',
  AR_INVOICE_VOIDED: 'AR_INVOICE_VOIDED',
  // BVM Wiring — Phase 1A. Emitted by postAndWireBizVoucher() after voucher
  // header POST + all line-wiring side effects commit atomically.
  VOUCHER_POSTED_AND_WIRED: 'VOUCHER_POSTED_AND_WIRED',
} as const;
/** Derived union for emitted Order Fin outbox events. */
export type OutboxEventType =
  (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

/** Outbox processing states mirrored from the shared events table. */
export const OUTBOX_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
/** Derived union for outbox processing states. */
export type OutboxStatus = (typeof OUTBOX_STATUSES)[keyof typeof OUTBOX_STATUSES];

/**
 * Checkout settlement routing mirrored from `org_payment_methods_cf.payment_nature`.
 *
 * Why:
 * Order Fin resolves each leg into one of these paths before writing facts.
 */
export const PAYMENT_NATURE = {
  REAL_PAYMENT: 'REAL_PAYMENT',
  CREDIT_APPLICATION: 'CREDIT_APPLICATION',
  DEFERRED_SETTLEMENT: 'DEFERRED_SETTLEMENT',
  AR_ALLOCATION: 'AR_ALLOCATION',
  INTERNAL_ADJUSTMENT: 'INTERNAL_ADJUSTMENT',
} as const;
/** Derived union for payment-leg routing categories. */
export type PaymentNature = (typeof PAYMENT_NATURE)[keyof typeof PAYMENT_NATURE];

/** Settlement type codes mirrored from `sys_payment_type_cd.payment_type_code`. */
export const SETTLEMENT_TYPE_CODES = {
  PAY_IN_ADVANCE: 'PAY_IN_ADVANCE',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  PAY_ON_DELIVERY: 'PAY_ON_DELIVERY',
  CREDIT_INVOICE: 'CREDIT_INVOICE',
} as const;
/** Derived union for order settlement type codes. */
export type SettlementTypeCode =
  (typeof SETTLEMENT_TYPE_CODES)[keyof typeof SETTLEMENT_TYPE_CODES];

/**
 * Canonical Batch 0 order payment snapshot values persisted on `org_orders_mst.payment_status`.
 *
 * Why:
 * The DB constraint only supports these uppercase values in Batch 0, so the
 * constant intentionally excludes broader lifecycle concepts such as refunded
 * or failed states.
 */
export const ORDER_PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PENDING_COLLECTION: 'PENDING_COLLECTION',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERPAID: 'OVERPAID',
} as const;
/** Derived union for canonical Batch 0 order payment statuses. */
export type OrderPaymentStatus =
  (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];

/** Loyalty ledger transaction types mirrored from `org_loyalty_txn_dtl.txn_type`. */
export const LOYALTY_TXN_TYPES = {
  EARN: 'EARN',
  REDEEM: 'REDEEM',
  EXPIRE: 'EXPIRE',
  ADJUST: 'ADJUST',
  BONUS: 'BONUS',
} as const;
/** Derived union for loyalty ledger transaction types. */
export type LoyaltyTxnType =
  (typeof LOYALTY_TXN_TYPES)[keyof typeof LOYALTY_TXN_TYPES];

/** Credit note lifecycle states mirrored from `org_credit_notes_mst.status`. */
export const CREDIT_NOTE_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXHAUSTED: 'EXHAUSTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
/** Derived union for credit note lifecycle states. */
export type CreditNoteStatus =
  (typeof CREDIT_NOTE_STATUSES)[keyof typeof CREDIT_NOTE_STATUSES];
