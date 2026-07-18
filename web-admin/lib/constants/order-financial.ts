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
  ADVANCE:          'ADVANCE',
  CREDIT_NOTE:      'CREDIT_NOTE',
  LOYALTY_POINTS:   'LOYALTY_POINTS',
  /** @deprecated Alias — use CREDIT_NOTE. Kept for refund-classification compat. */
  CUSTOMER_CREDIT:  'CREDIT_NOTE',
  CUSTOMER_ADVANCE: 'ADVANCE',
  LOYALTY_CREDIT:   'LOYALTY_POINTS',
} as const;
/** Derived union for stored-value application codes. */
export type CreditApplicationType =
  (typeof CREDIT_APPLICATION_TYPES)[keyof typeof CREDIT_APPLICATION_TYPES];

/**
 * Credit-application lifecycle states persisted in
 * `org_order_credit_apps_dtl.application_status`.
 *
 * Why:
 * Order Fin v1.1 separates credits that are already applied from credits that
 * are pending, failed, or reversed so the order header can surface those
 * buckets without overloading `is_active` / `rec_status`.
 */
export const CREDIT_APPLICATION_STATUSES = {
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  PROCESSING: 'PROCESSING',
  APPLIED: 'APPLIED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
  EXPIRED: 'EXPIRED',
} as const;
/** Derived union for credit-application lifecycle states. */
export type CreditApplicationStatus =
  (typeof CREDIT_APPLICATION_STATUSES)[keyof typeof CREDIT_APPLICATION_STATUSES];

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
  CREDIT_APPLICATION_TYPES.ADVANCE,
  CREDIT_APPLICATION_TYPES.CREDIT_NOTE,
  CREDIT_APPLICATION_TYPES.LOYALTY_POINTS,
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
  [CREDIT_APPLICATION_TYPES.ADVANCE]:          'a',
  [CREDIT_APPLICATION_TYPES.CREDIT_NOTE]:      'cn',
  [CREDIT_APPLICATION_TYPES.LOYALTY_POINTS]:   'lp',
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

/**
 * Refund source type codes persisted in `org_order_refunds_dtl.refund_source_type`.
 *
 * D002 v2 (APPROVED Expert 2026-07-16, B01) — ORIGIN-ONLY registry: the source
 * names where the refunded value originally came from, never where the customer
 * receives it (that is the destination facet, `refund_method_code`). The retired
 * CUSTOMER_CREDIT_ISSUE / CREDIT_NOTE_ISSUE values named destinations and moved
 * to LEGACY_REFUND_SOURCE_TYPES (read-only display of pre-B01 rows).
 *
 * Why distinct *_RESTORE values (no generic STORED_VALUE_RESTORE):
 * Each stored-value vehicle has separate audit, fiscal, and balance-sheet
 * implications and must trace to its originating ledger (ZATCA/UAE/Oman).
 * MANUAL_EXCEPTION is operator-explicit (lineage forbidden, mandatory note,
 * permission-gated); GOODWILL_CONCESSION covers refunds with no prior
 * settlement leg (mandatory reason).
 *
 * DB-mirror: values must match `chk_refund_source_type_v2` (migration 0404).
 */
export const REFUND_SOURCE_TYPES = {
  REAL_PAYMENT_REFUND:      'REAL_PAYMENT_REFUND',
  GIFT_CARD_RESTORE:        'GIFT_CARD_RESTORE',
  WALLET_RESTORE:           'WALLET_RESTORE',
  CUSTOMER_ADVANCE_RESTORE: 'CUSTOMER_ADVANCE_RESTORE',
  CUSTOMER_CREDIT_RESTORE:  'CUSTOMER_CREDIT_RESTORE',
  GOODWILL_CONCESSION:      'GOODWILL_CONCESSION',
  MANUAL_EXCEPTION:         'MANUAL_EXCEPTION',
} as const;
/** Derived union for refund source type codes. */
export type RefundSourceType = (typeof REFUND_SOURCE_TYPES)[keyof typeof REFUND_SOURCE_TYPES];

/**
 * Retired source values (D002 v2): they named destinations, not origins.
 * Kept ONLY for reading/labeling rows written before migration 0404 — never
 * valid for new writes (`chk_refund_source_type_v2` rejects them).
 */
export const LEGACY_REFUND_SOURCE_TYPES = {
  CUSTOMER_CREDIT_ISSUE: 'CUSTOMER_CREDIT_ISSUE',
  CREDIT_NOTE_ISSUE:     'CREDIT_NOTE_ISSUE',
} as const;
/** Derived union for retired (read-only) refund source type codes. */
export type LegacyRefundSourceType =
  (typeof LEGACY_REFUND_SOURCE_TYPES)[keyof typeof LEGACY_REFUND_SOURCE_TYPES];

/**
 * Refund reason_context codes persisted in `org_order_refunds_dtl.refund_context`.
 *
 * D002 v2 fifth facet — drives the D003 v2 reopen-due rules: commercial
 * contexts (STANDARD, PRICE_ADJUSTMENT_GOODWILL, CANCELLATION_UNWIND) never
 * reopen the customer's due; a positive `reopens_due_amount` requires
 * REFUND_AND_REBILL (permissioned, B27) or MANUAL_EXCEPTION (operator-entered,
 * bounded). DB-mirror: `chk_refund_context_v2` / `chk_refund_reopen_context_v2`
 * (migration 0404).
 */
export const REFUND_CONTEXTS = {
  STANDARD:                  'STANDARD',
  PRICE_ADJUSTMENT_GOODWILL: 'PRICE_ADJUSTMENT_GOODWILL',
  CANCELLATION_UNWIND:       'CANCELLATION_UNWIND',
  REFUND_AND_REBILL:         'REFUND_AND_REBILL',
  MANUAL_EXCEPTION:          'MANUAL_EXCEPTION',
} as const;
/** Derived union for refund reason_context codes. */
export type RefundContext = (typeof REFUND_CONTEXTS)[keyof typeof REFUND_CONTEXTS];

/**
 * Stable machine-readable codes for refund validation failures (B01).
 * Returned in API error payloads (and mapped to i18n labels client-side) so
 * callers never have to parse human-readable messages.
 */
export const REFUND_ERROR_CODES = {
  /** Declared/derived source does not match the supplied lineage (or both lineage fields sent). */
  REFUND_SOURCE_LINEAGE_MISMATCH: 'REFUND_SOURCE_LINEAGE_MISMATCH',
  /** Same idempotency key replayed with a different payload (S2 conflict pattern). */
  REFUND_IDEMPOTENCY_CONFLICT: 'REFUND_IDEMPOTENCY_CONFLICT',
  /** reason_context REFUND_AND_REBILL is rejected until the B27 permission code ships. */
  REFUND_AND_REBILL_NOT_AVAILABLE: 'REFUND_AND_REBILL_NOT_AVAILABLE',
  /** refund_context missing or outside the D002 v2 registry. */
  REFUND_CONTEXT_INVALID: 'REFUND_CONTEXT_INVALID',
  /** Operator reopen amount outside 0..refund_amount or supplied on a non-manual context. */
  REFUND_REOPEN_INVALID: 'REFUND_REOPEN_INVALID',
  /** Maker-checker: the requester attempted to approve their own refund (B34). */
  REFUND_SELF_APPROVAL_BLOCKED: 'REFUND_SELF_APPROVAL_BLOCKED',
} as const;
/** Derived union for refund validation error codes. */
export type RefundErrorCode = (typeof REFUND_ERROR_CODES)[keyof typeof REFUND_ERROR_CODES];

/**
 * Finance document-sequence type for refund numbers. Mirrors the
 * `org_fin_doc_seq_mst.doc_type_code` value seeded by the refund-numbering
 * migration. Refund numbers are issued atomically via `fn_next_fin_doc_no`
 * (row-level `FOR UPDATE` lock) to avoid the `count(*)+1` concurrency race.
 */
export const REFUND_DOC_TYPE_CODE = 'REFUND' as const;

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
  // B20: refund rows vs D003 v2 reopen policy — mirrors the DB CHECK
  // `chk_refund_reopen_context_v2` (migration 0404) as a monitoring layer that
  // also catches any legacy/pre-0404 or synthetic row the DB constraint cannot
  // see (surfaced in the recon UI, not just as a silent write-time rejection).
  REFUND_REOPEN_CONSISTENCY: 'REFUND_REOPEN_CONSISTENCY',
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

  // ─── v1.1 §8.11 — tax-base decomposition reconciliation ───────────────────
  // Verifies that the four canonical tax-base buckets stored on
  // org_orders_mst (taxable_amount + non_taxable_amount + exempt_amount +
  // zero_rated_amount + out_of_scope_amount) reconcile against the order's
  // commercial base. Today the tax engine emits only taxable_amount, so the
  // check stays advisory until Phase 5 wires bucket classification.
  TAX_BASE_BUCKETS_SUM: 'TAX_BASE_BUCKETS_SUM',

  // ─── v1.1 §10.x — credit lifecycle / voucher-target integrity ────────────
  PAYMENT_TARGET_VS_ORDER_TOTALS: 'PAYMENT_TARGET_VS_ORDER_TOTALS',
  CREDIT_APP_LIFECYCLE_CONSISTENCY: 'CREDIT_APP_LIFECYCLE_CONSISTENCY',

  // ─── ADR-039 — base-currency reporting snapshots ─────────────────────────
  BASE_CURRENCY_RATE_PRESENT: 'BASE_CURRENCY_RATE_PRESENT',
  BASE_VS_ORDER_AMOUNT_CONSISTENCY: 'BASE_VS_ORDER_AMOUNT_CONSISTENCY',

  // ─── ADR-017 — tax-inclusive pricing mode consistency ────────────────────
  // Verifies that the tax_pricing_mode recorded in the order's
  // financial_calculation_snapshot matches the branch/tenant config that was
  // active at calculation time, so drifted snapshots are flagged.
  PRICING_MODE_CONSISTENCY: 'PRICING_MODE_CONSISTENCY',

  // ─── ADR-030 — refund source lineage (Phase 6) ───────────────────────────
  REFUND_SOURCE_LINEAGE_CLASSIFICATION: 'REFUND_SOURCE_LINEAGE_CLASSIFICATION',
  REFUND_REOPENS_DUE_BOUND: 'REFUND_REOPENS_DUE_BOUND',

  // ─── Phase 7 — tax-document lifecycle ────────────────────────────────────
  RECON_TAX_DOC_SEQUENCE_GAPS: 'RECON_TAX_DOC_SEQUENCE_GAPS',
  RECON_TAX_DOC_IMMUTABILITY: 'RECON_TAX_DOC_IMMUTABILITY',
  RECON_TAX_DOC_VS_ORDER_TOTALS: 'RECON_TAX_DOC_VS_ORDER_TOTALS',
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
  /**
   * Order-Fin remediation Phase 4 (FN-02). Emitted by
   * unwindOrderFinancialsOnCancel() after a cancelled order's financial
   * unwind commits: credit applications reversed to source ledgers, real
   * payments routed per the chosen disposition (REFUND / STORE_CREDIT /
   * KEEP_ON_ACCOUNT), promo usage reversed, snapshot recalculated. The
   * payload is the durable audit record of where the customer's money went.
   * Not mapped into org_order_history (the cancel RPC already writes the
   * status row); the history consumer intentionally ignores this type.
   */
  ORDER_CANCEL_FINANCIAL_UNWIND: 'ORDER_CANCEL_FINANCIAL_UNWIND',
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

/**
 * Tax pricing mode codes persisted in `org_tenants_mst.tax_pricing_mode` and
 * `org_branches_mst.tax_pricing_mode` (branch value is nullable — NULL means
 * inherit tenant default).
 *
 * TAX_EXCLUSIVE: total = net_before_tax + tax + rounding (current default).
 * TAX_INCLUSIVE: tax is extracted from the inclusive item price; tax is NOT
 *   added to total again — total = net_before_tax + rounding.
 */
export const TAX_PRICING_MODES = {
  TAX_EXCLUSIVE: 'TAX_EXCLUSIVE',
  TAX_INCLUSIVE: 'TAX_INCLUSIVE',
} as const;
/** Derived union for tax pricing mode codes. */
export type TaxPricingMode = (typeof TAX_PRICING_MODES)[keyof typeof TAX_PRICING_MODES];

/**
 * Extra-price presentation mode codes persisted in
 * `org_tenants_mst.extra_price_pricing_mode` (and branch override).
 */
export const EXTRA_PRICE_PRICING_MODES = {
  INCLUDED_IN_ITEM_PRICE: 'INCLUDED_IN_ITEM_PRICE',
  SEPARATE_CHARGE: 'SEPARATE_CHARGE',
} as const;
/** Derived union for extra-price presentation mode codes. */
export type ExtraPricePricingMode =
  (typeof EXTRA_PRICE_PRICING_MODES)[keyof typeof EXTRA_PRICE_PRICING_MODES];

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
 * @param paymentTypeCode
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

// ─── Phase 7 — Tax-Document Full Lifecycle ───────────────────────────────────

/** Document type codes persisted in `org_tax_documents_mst.document_type`. */
export const TAX_DOCUMENT_TYPES = {
  INVOICE:              'INVOICE',
  SIMPLIFIED_INVOICE:   'SIMPLIFIED_INVOICE',
  CREDIT_NOTE:          'CREDIT_NOTE',
  DEBIT_NOTE:           'DEBIT_NOTE',
} as const;
/** Derived union for tax document types. */
export type TaxDocumentType =
  (typeof TAX_DOCUMENT_TYPES)[keyof typeof TAX_DOCUMENT_TYPES];

/** Lifecycle status codes persisted in `org_tax_documents_mst.status`. */
export const TAX_DOCUMENT_STATUSES = {
  DRAFT:      'DRAFT',
  ISSUED:     'ISSUED',
  CANCELLED:  'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
/** Derived union for tax document lifecycle states. */
export type TaxDocumentStatus =
  (typeof TAX_DOCUMENT_STATUSES)[keyof typeof TAX_DOCUMENT_STATUSES];

/**
 * Trigger event codes persisted in `org_tax_documents_mst.trigger_event`
 * and `org_tax_doc_triggers_cfg.trigger_event`.
 *
 * LEGACY_BACKFILL is for rows migrated from the pre-Phase-7 shallow columns
 * on org_orders_mst — it is NOT a valid value for new trigger configs.
 */
export const TAX_DOCUMENT_TRIGGER_EVENTS = {
  ON_ORDER_SUBMIT:          'ON_ORDER_SUBMIT',
  ON_PAYMENT_CONFIRMATION:  'ON_PAYMENT_CONFIRMATION',
  ON_SERVICE_COMPLETION:    'ON_SERVICE_COMPLETION',
  ON_DELIVERY:              'ON_DELIVERY',
  ON_AR_INVOICE_ISSUE:      'ON_AR_INVOICE_ISSUE',
  LEGACY_BACKFILL:          'LEGACY_BACKFILL',
} as const;
/** Derived union for tax document trigger events. */
export type TaxDocumentTriggerEvent =
  (typeof TAX_DOCUMENT_TRIGGER_EVENTS)[keyof typeof TAX_DOCUMENT_TRIGGER_EVENTS];
