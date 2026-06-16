/**
 * Payment / settlement catalog constants — mirrors sys_fin_* DB catalogs.
 * Single source of truth for overpayment resolution, receipt allocation, and voucher source types.
 *
 * DB tables (migration 0357):
 * - sys_fin_overpay_res_cd
 * - sys_fin_vch_source_type_cd
 * - sys_fin_rcpt_alloc_mode_cd
 * - sys_fin_rcpt_fb_dest_cd
 * - sys_fin_rem_bal_policy_cd
 */

/** sys_fin_overpay_res_cd.resolution_code */
export const OVERPAYMENT_RESOLUTIONS = {
  REDUCE_PAYMENT: 'REDUCE_PAYMENT',
  RETURN_CASH_CHANGE: 'RETURN_CASH_CHANGE',
  VOID_OR_REFUND_EXCESS: 'VOID_OR_REFUND_EXCESS',
  SAVE_AS_CUSTOMER_ADVANCE: 'SAVE_AS_CUSTOMER_ADVANCE',
  SAVE_TO_CUSTOMER_WALLET: 'SAVE_TO_CUSTOMER_WALLET',
  SAVE_AS_CUSTOMER_CREDIT: 'SAVE_AS_CUSTOMER_CREDIT',
  RESTORE_STORED_VALUE: 'RESTORE_STORED_VALUE',
  ALLOCATE_TO_CUSTOMER_BALANCES: 'ALLOCATE_TO_CUSTOMER_BALANCES',
  AUTO_ALLOCATE_TO_CUSTOMER_BALANCES: 'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES',
} as const;

export type OverpaymentResolutionCode =
  (typeof OVERPAYMENT_RESOLUTIONS)[keyof typeof OVERPAYMENT_RESOLUTIONS];

/** Phase 2–3 disposition lines use catalog resolution codes directly. */
export const PHASE2_OVERPAYMENT_RESOLUTIONS = [
  OVERPAYMENT_RESOLUTIONS.REDUCE_PAYMENT,
  OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE,
  OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE,
  OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET,
  OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
  OVERPAYMENT_RESOLUTIONS.RESTORE_STORED_VALUE,
] as const;

/** Phase 4 — customer receipt allocation resolutions (ALLOCATE_* / AUTO_ALLOCATE_*). */
export const PHASE4_ALLOCATION_RESOLUTIONS = [
  OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES,
  OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
] as const;

/** sys_fin_vch_source_type_cd.source_type */
export const VOUCHER_SOURCE_TYPES = {
  ORDER_SUBMIT: 'ORDER_SUBMIT',
  ORDER_PAYMENT_MODAL: 'ORDER_PAYMENT_MODAL',
  CUSTOMER_RECEIPT: 'CUSTOMER_RECEIPT',
  ACCOUNT_RECEIPT: 'ACCOUNT_RECEIPT',
  POS_OVERPAYMENT_ALLOCATION: 'POS_OVERPAYMENT_ALLOCATION',
  CUSTOMER_ACCOUNT_PAYMENT: 'CUSTOMER_ACCOUNT_PAYMENT',
  AR_INVOICE_COLLECTION: 'AR_INVOICE_COLLECTION',
  B2B_STATEMENT_COLLECTION: 'B2B_STATEMENT_COLLECTION',
  WALLET_TOPUP: 'WALLET_TOPUP',
  GIFT_CARD_SALE: 'GIFT_CARD_SALE',
  CUSTOMER_ADVANCE_RECEIPT: 'CUSTOMER_ADVANCE_RECEIPT',
  MANUAL_VOUCHER: 'MANUAL_VOUCHER',
  GATEWAY_CALLBACK: 'GATEWAY_CALLBACK',
  REFUND_PROCESS: 'REFUND_PROCESS',
} as const;

export type VoucherSourceType =
  (typeof VOUCHER_SOURCE_TYPES)[keyof typeof VOUCHER_SOURCE_TYPES];

/** sys_fin_rcpt_alloc_mode_cd.allocation_mode */
export const CUSTOMER_RECEIPT_ALLOCATION_MODES = {
  AUTO_OLDEST_DUE: 'AUTO_OLDEST_DUE',
  AUTO_OLDEST_DOCUMENT: 'AUTO_OLDEST_DOCUMENT',
  AUTO_PRIORITY_THEN_OLDEST: 'AUTO_PRIORITY_THEN_OLDEST',
  MANUAL_ONLY: 'MANUAL_ONLY',
} as const;

export type CustomerReceiptAllocationMode =
  (typeof CUSTOMER_RECEIPT_ALLOCATION_MODES)[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_MODES];

/** sys_fin_rcpt_fb_dest_cd.fallback_destination — allocation fallback (not overpayment resolution). */
export const CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS = {
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  /** Cash change fallback during receipt allocation; distinct from RETURN_CASH_CHANGE resolution. */
  RETURN_CHANGE: 'RETURN_CHANGE',
  BLOCK_AND_REQUIRE_MANUAL_ACTION: 'BLOCK_AND_REQUIRE_MANUAL_ACTION',
} as const;

export type CustomerReceiptFallbackDestination =
  (typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS)[keyof typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS];

/** sys_fin_rem_bal_policy_cd.policy_code */
export const REMAINING_BALANCE_POLICIES = {
  FULL_PAYMENT: 'FULL_PAYMENT',
  PAY_ON_COLLECTION: 'PAY_ON_COLLECTION',
  CREDIT_INVOICE: 'CREDIT_INVOICE',
  B2B_STATEMENT: 'B2B_STATEMENT',
} as const;

export type RemainingBalancePolicyCode =
  (typeof REMAINING_BALANCE_POLICIES)[keyof typeof REMAINING_BALANCE_POLICIES];

/** Money epsilon for resolution/allocation sum validation. */
export const SETTLEMENT_MONEY_EPSILON = 0.001;

/** Submit-order / planner error codes. */
export const OVERPAYMENT_RESOLUTION_ERROR_CODES = {
  REQUIRED: 'OVERPAYMENT_RESOLUTION_REQUIRED',
  MISMATCH: 'OVERPAYMENT_RESOLUTION_MISMATCH',
  NOT_ALLOWED: 'OVERPAYMENT_RESOLUTION_NOT_ALLOWED',
  RETURN_CHANGE_EXCEEDS_CAPACITY: 'RETURN_CHANGE_EXCEEDS_CAPACITY',
  RETURN_CHANGE_LEG_INVALID: 'RETURN_CHANGE_LEG_INVALID',
  EXCESS_UNRESOLVED: 'RECEIPT_ALLOCATION_EXCESS_UNRESOLVED',
} as const;

export type OverpaymentResolutionErrorCode =
  (typeof OVERPAYMENT_RESOLUTION_ERROR_CODES)[keyof typeof OVERPAYMENT_RESOLUTION_ERROR_CODES];

/** RBAC permissions — migrations 0354 + 0357. */
export const OVERPAYMENT_RESOLUTION_PERMISSIONS = {
  DISPOSE: 'orders:overpayment_dispose',
  ALLOCATE: 'orders:overpayment_allocate',
  TO_WALLET: 'orders:overpayment_to_wallet',
  TO_ADVANCE: 'orders:overpayment_to_advance',
  TO_CREDIT: 'orders:overpayment_to_credit',
  TO_CREDIT_NOTE: 'orders:overpayment_to_credit_note',
} as const;

/** Default tenant policy code seeded for demo tenants. */
export const DEFAULT_RECEIPT_ALLOCATION_POLICY_CODE = 'DEFAULT_OLDEST_DUE';
