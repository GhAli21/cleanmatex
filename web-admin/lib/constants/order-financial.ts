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

/**
 * Canonical lock-acquisition order for stored-value balances inside the
 * submit-order voucher transaction (Phase 2 BVM Wiring).
 *
 * Why a fixed order:
 * Submit-order can debit multiple stored-value balances for the same customer
 * in a single transaction (gift card + wallet + loyalty). Two concurrent
 * submits that touch the same customer's balances in opposite orders would
 * deadlock on SELECT … FOR UPDATE. Sorting every redemption batch by this
 * canonical order before taking row locks guarantees a deterministic lock
 * sequence and eliminates the deadlock window.
 *
 * Values mirror CREDIT_APPLICATION_TYPES (DB-mirror rule).
 */
export const STORED_VALUE_LOCK_ORDER = [
  CREDIT_APPLICATION_TYPES.GIFT_CARD,
  CREDIT_APPLICATION_TYPES.WALLET,
  CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE,
  CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT,
  CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT,
] as const satisfies readonly CreditApplicationType[];

/**
 * Short code per stored-value credit application type, used as the
 * discriminator in the Phase 2 sub-idempotency key format
 * `${orderId}_sv_${code}_${legIndex}`.
 *
 * Why short codes:
 * Submit-order can write multiple stored-value redemption rows against the
 * same order. Each *_txn_dtl ledger table enforces a unique
 * `(tenant_org_id, idempotency_key)` index — without per-leg discriminators
 * the orchestrator would collide on retries. Short two-letter codes keep
 * the unique-index entries lean and match the Round-2 Fix A pattern
 * (orderId-prefixed sub-keys).
 *
 * BVM Wiring Phase 6 Sub-item 3: hoisted from `order-submit-orchestrator`
 * into this canonical constants file so other services that need to
 * derive the same sub-key shape (reconciliation backfills, retry replays)
 * can import the map instead of re-declaring it.
 */
export type StoredValueSubIdempotencyCode = 'gc' | 'w' | 'a' | 'cn' | 'lp';

export const STORED_VALUE_SUB_IDEMPOTENCY_CODE: Readonly<
  Record<CreditApplicationType, StoredValueSubIdempotencyCode>
> = Object.freeze({
  [CREDIT_APPLICATION_TYPES.GIFT_CARD]:        'gc',
  [CREDIT_APPLICATION_TYPES.WALLET]:           'w',
  [CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE]: 'a',
  [CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT]:  'cn',
  [CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT]:   'lp',
});

/** Rank lookup for sorting stored-value legs by STORED_VALUE_LOCK_ORDER. */
export const STORED_VALUE_LOCK_RANK: Readonly<Record<CreditApplicationType, number>> =
  Object.freeze(
    STORED_VALUE_LOCK_ORDER.reduce(
      (acc, type, index) => {
        acc[type] = index;
        return acc;
      },
      {} as Record<CreditApplicationType, number>,
    ),
  );

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
/**
 * Reconciliation check identifiers persisted in `org_fin_recon_issues_dtl.check_name`.
 *
 * Why a closed enum:
 * The reconciliation UI groups issues by check, the CSV export labels them, and
 * downstream remediation playbooks are keyed by these strings. Drift between
 * service and DB silently hides regressions, so every check name lives here.
 *
 * Phase 4 (BVM Wiring) expansion sources the names from PRD §22.1; legacy
 * pre-BVM names are retained for backward compatibility with persisted rows.
 */
export const RECONCILIATION_CHECK_NAMES = {
  // ─── Legacy Order Financial Platform checks (pre-BVM) ─────────────────────
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

  // ─── BVM Phase 4 — voucher integrity (PRD §22.1) ──────────────────────────
  VOUCHER_TOTAL_EQUALS_LINES: 'VOUCHER_TOTAL_EQUALS_LINES',
  NO_DUPLICATE_OPERATIONAL_EFFECT: 'NO_DUPLICATE_OPERATIONAL_EFFECT',
  GATEWAY_STATE_VALID: 'GATEWAY_STATE_VALID',

  // ─── BVM Phase 4 — order ↔ voucher link checks (PRD §22.1) ────────────────
  ORDER_PAYMENT_LINK_EXISTS: 'ORDER_PAYMENT_LINK_EXISTS',
  ORDER_PAYMENT_AMOUNT_MATCHES_LINE: 'ORDER_PAYMENT_AMOUNT_MATCHES_LINE',
  ORDER_CREDIT_APPLICATION_LINK_EXISTS: 'ORDER_CREDIT_APPLICATION_LINK_EXISTS',
  ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE: 'ORDER_CREDIT_APPLICATION_AMOUNT_MATCHES_LINE',
  ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS: 'ORDER_CREDIT_APPLICATION_NOT_IN_PAYMENTS',
  ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS: 'ORDER_CREDIT_APPLICATION_NOT_IN_DISCOUNTS',

  // ─── BVM Phase 4 — order snapshot integrity (PRD §22.1) ───────────────────
  ORDER_CHARGES_MATCH_SNAPSHOT: 'ORDER_CHARGES_MATCH_SNAPSHOT',
  ORDER_PIECES_MATCH_CHARGES: 'ORDER_PIECES_MATCH_CHARGES',
  ORDER_PREFERENCES_MATCH_CHARGES: 'ORDER_PREFERENCES_MATCH_CHARGES',
  PIECE_EXTRA_PRICE_INCLUDED_ONCE: 'PIECE_EXTRA_PRICE_INCLUDED_ONCE',
  PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE: 'PREFERENCE_EXTRA_PRICE_INCLUDED_ONCE',

  // ─── BVM Phase 4 — stored-value ledger backlink checks (PRD §22.1) ────────
  // Use the FK backlinks added in migration 0329 (fin_voucher_id +
  // fin_voucher_trx_line_id on every stored-value txn table).
  WALLET_LEDGER_LINK_EXISTS: 'WALLET_LEDGER_LINK_EXISTS',
  ADVANCE_LEDGER_LINK_EXISTS: 'ADVANCE_LEDGER_LINK_EXISTS',
  GIFT_CARD_LEDGER_LINK_EXISTS: 'GIFT_CARD_LEDGER_LINK_EXISTS',
  CREDIT_NOTE_LEDGER_LINK_EXISTS: 'CREDIT_NOTE_LEDGER_LINK_EXISTS',
  LOYALTY_LEDGER_LINK_EXISTS: 'LOYALTY_LEDGER_LINK_EXISTS',

  // ─── BVM Phase 4 — cash drawer integrity (PRD §22.1) ──────────────────────
  CASH_MOVEMENT_LINK_EXISTS: 'CASH_MOVEMENT_LINK_EXISTS',
  CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT: 'CASH_MOVEMENT_AMOUNT_EQUALS_RETAINED_AMOUNT',

  // ─── BVM Phase 4 — AR / refund link checks (PRD §22.1) ────────────────────
  INVOICE_PAYMENT_LINK_EXISTS: 'INVOICE_PAYMENT_LINK_EXISTS',
  REFUND_LINK_EXISTS: 'REFUND_LINK_EXISTS',
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
  /**
   * BVM Wiring — Phase 6 Sub-item 1. Emitted by verifyPaymentTx() after
   * a PENDING REAL_PAYMENT leg is flipped to COMPLETED. The Phase 5
   * order-history consumer translates this into a PAYMENT_VERIFIED row
   * on org_order_history. Aggregate type = 'order_payment'.
   *
   * DB-mirror invariant: the string value must match the
   * `chk_history_action_type` CHECK enum value introduced by migration
   * 0332 (PAYMENT_VERIFIED) exactly — case and spelling.
   */
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
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
 * Payment type codes allowed to populate `org_orders_mst.ar_receivable_amount`.
 *
 * Why:
 * The final plan forbids silently inferring invoice-like aliases. We freeze the
 * discovered set here after repo review so every service uses the same rule.
 */
export const AR_RECEIVABLE_PAYMENT_TYPE_CODES = [
  SETTLEMENT_TYPE_CODES.CREDIT_INVOICE,
] as const satisfies readonly SettlementTypeCode[];
/** Derived union for receivable-producing payment type codes. */
export type ArReceivablePaymentTypeCode = (typeof AR_RECEIVABLE_PAYMENT_TYPE_CODES)[number];

/**
 * Canonical real-payment lifecycle buckets used by the financial snapshot.
 *
 * Why:
 * Header settlement math must classify mixed historical values consistently in
 * SQL backfills, write services, and reconciliation checks.
 */
export const ORDER_PAYMENT_LIFECYCLE_STATUSES = {
  COMPLETED: ['COMPLETED', 'CAPTURED', 'SETTLED'],
  PENDING: ['PENDING', 'PROCESSING', 'CAPTURE_PENDING'],
  AUTHORIZED: ['AUTHORIZED'],
  FAILED: ['FAILED', 'CANCELLED', 'EXPIRED', 'VOIDED', 'REFUSED', 'REVERSED'],
} as const;
/** Derived union for supported uppercase payment lifecycle statuses. */
export type OrderPaymentLifecycleStatus =
  (typeof ORDER_PAYMENT_LIFECYCLE_STATUSES)[keyof typeof ORDER_PAYMENT_LIFECYCLE_STATUSES][number];

/**
 * Canonical snapshot statuses persisted on `org_orders_mst.financial_snapshot_status`.
 *
 * Why:
 * Summary views and repair jobs need one explicit signal that separates
 * healthy snapshots from mismatches and from rows that still depend on
 * legacy fallbacks or ambiguous historical lineage.
 */
export const ORDER_FINANCIAL_SNAPSHOT_STATUS = {
  CURRENT: 'CURRENT',
  MISMATCH: 'MISMATCH',
  RECALCULATION_REQUIRED: 'RECALCULATION_REQUIRED',
  STALE: 'STALE',
  LOCKED: 'LOCKED',
} as const;
/** Derived union for financial snapshot status values. */
export type OrderFinancialSnapshotStatus =
  (typeof ORDER_FINANCIAL_SNAPSHOT_STATUS)[keyof typeof ORDER_FINANCIAL_SNAPSHOT_STATUS];

/**
 * Canonical financial warning codes written into the snapshot JSON and UI.
 *
 * Why:
 * These strings are part of the persisted calculation trace, so they must stay
 * centralized to prevent silent drift across SQL backfills, services, and views.
 */
export const ORDER_FINANCIAL_WARNING_CODES = {
  ORDER_TOTAL_COMPONENT_MISMATCH: 'ORDER_TOTAL_COMPONENT_MISMATCH',
  DISCOUNT_TOTAL_MISMATCH: 'DISCOUNT_TOTAL_MISMATCH',
  TAX_TOTAL_MISMATCH: 'TAX_TOTAL_MISMATCH',
  OUTSTANDING_MISMATCH: 'OUTSTANDING_MISMATCH',
  PENDING_PAYMENT_COUNTED_AS_PAID: 'PENDING_PAYMENT_COUNTED_AS_PAID',
  AUTHORIZED_PAYMENT_COUNTED_AS_PAID: 'AUTHORIZED_PAYMENT_COUNTED_AS_PAID',
  GIFT_CARD_DOUBLE_COUNTED: 'GIFT_CARD_DOUBLE_COUNTED',
  CREDIT_APPLICATION_COUNTED_AS_DISCOUNT: 'CREDIT_APPLICATION_COUNTED_AS_DISCOUNT',
  AR_RECEIVABLE_MISMATCH: 'AR_RECEIVABLE_MISMATCH',
  TAX_DOCUMENT_TOTAL_MISMATCH: 'TAX_DOCUMENT_TOTAL_MISMATCH',
  LEGACY_FIELD_USED_IN_SUMMARY: 'LEGACY_FIELD_USED_IN_SUMMARY',
  REFUND_SOURCE_UNCLASSIFIED: 'REFUND_SOURCE_UNCLASSIFIED',
  PAYMENT_TARGET_UNCLASSIFIED: 'PAYMENT_TARGET_UNCLASSIFIED',
} as const;
/** Derived union for canonical financial warning codes. */
export type OrderFinancialWarningCode =
  (typeof ORDER_FINANCIAL_WARNING_CODES)[keyof typeof ORDER_FINANCIAL_WARNING_CODES];

/**
 * Normalize and test whether a payment type should produce AR receivable.
 *
 * Why:
 * Services should not duplicate inline string checks when the approved set is
 * intentionally narrow and locked by the final rollout plan.
 */
export function isArReceivablePaymentTypeCode(
  paymentTypeCode: string | null | undefined,
): paymentTypeCode is ArReceivablePaymentTypeCode {
  if (!paymentTypeCode) return false;
  return (AR_RECEIVABLE_PAYMENT_TYPE_CODES as readonly string[]).includes(paymentTypeCode);
}

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
