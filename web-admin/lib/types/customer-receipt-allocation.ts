import {
  CUSTOMER_RECEIPT_ALLOCATION_MODES,
  CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS,
  VOUCHER_SOURCE_TYPES,
} from '@/lib/constants/settlement-catalog';
import { LINE_ROLE, TARGET_TYPE } from '@/lib/constants/voucher';

/** API / feature-pack target labels (AR_INVOICE) vs BVM DB target (INVOICE). */
export const CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES = {
  ORDER: TARGET_TYPE.ORDER,
  AR_INVOICE: 'AR_INVOICE',
  B2B_STATEMENT: TARGET_TYPE.B2B_STATEMENT,
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  RETURN_CHANGE: 'RETURN_CHANGE',
} as const;

/**
 *
 */
export type CustomerReceiptAllocationTargetType =
  (typeof CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES)[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES];

export const CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES = {
  ORDER_PAYMENT: LINE_ROLE.ORDER_PAYMENT,
  INVOICE_PAYMENT: LINE_ROLE.INVOICE_PAYMENT,
  STATEMENT_PAYMENT: LINE_ROLE.STATEMENT_PAYMENT,
  CUSTOMER_ADVANCE_RECEIPT: LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
  WALLET_TOPUP: LINE_ROLE.WALLET_TOPUP,
  CUSTOMER_CREDIT_ISSUE: LINE_ROLE.CUSTOMER_CREDIT_ISSUE,
} as const;

/**
 *
 */
export type CustomerReceiptAllocationLineRole =
  (typeof CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES)[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES];

export const CUSTOMER_RECEIPT_PREVIEW_STATUSES = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  POSTED: 'POSTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

/**
 *
 */
export type CustomerReceiptPreviewStatus =
  (typeof CUSTOMER_RECEIPT_PREVIEW_STATUSES)[keyof typeof CUSTOMER_RECEIPT_PREVIEW_STATUSES];

export const RECEIPT_ALLOCATION_WARNING_CODES = {
  UNBALANCED: 'RECEIPT_ALLOCATION_UNBALANCED',
  TARGET_PAID: 'RECEIPT_ALLOCATION_TARGET_PAID',
  CURRENCY_MISMATCH: 'RECEIPT_ALLOCATION_TARGET_CURRENCY_MISMATCH',
  ORDER_HAS_AR_INVOICE: 'RECEIPT_ALLOCATION_ORDER_HAS_AR_INVOICE',
  FALLBACK_REQUIRED: 'RECEIPT_ALLOCATION_FALLBACK_REQUIRED',
  POLICY_MISSING: 'RECEIPT_ALLOCATION_POLICY_MISSING',
  EXCESS_UNRESOLVED: 'RECEIPT_ALLOCATION_EXCESS_UNRESOLVED',
  IDEMPOTENCY_CONFLICT: 'RECEIPT_ALLOCATION_IDEMPOTENCY_CONFLICT',
  BLOCKED: 'RECEIPT_ALLOCATION_BLOCKED',
} as const;

/**
 * Stable error codes thrown while posting a customer account receipt (CLF W6).
 * The route returns them as `code`; the receipt screen maps each to an i18n key
 * under `customers.accountReceipt.errors`.
 */
export const CUSTOMER_RECEIPT_POST_ERRORS = {
  METHOD_UNAVAILABLE: 'CUSTOMER_RECEIPT_METHOD_UNAVAILABLE',
  CASH_TENDERED_TOO_LOW: 'CUSTOMER_RECEIPT_CASH_TENDERED_TOO_LOW',
  BANK_REFERENCE_REQUIRED: 'CUSTOMER_RECEIPT_BANK_REFERENCE_REQUIRED',
  CHECK_DETAILS_REQUIRED: 'CUSTOMER_RECEIPT_CHECK_DETAILS_REQUIRED',
  /**
   * Thrown by the voucher reversal core: reversing the receipt voucher would
   * return the cash but leave the order/invoice/stored-value allocations in
   * place. Correct a wrong receipt by reversing each allocation instead.
   */
  REVERSAL_NOT_SUPPORTED: 'CUSTOMER_RECEIPT_REVERSAL_NOT_SUPPORTED',
} as const;

/** One of {@link CUSTOMER_RECEIPT_POST_ERRORS}. */
export type CustomerReceiptPostErrorCode =
  (typeof CUSTOMER_RECEIPT_POST_ERRORS)[keyof typeof CUSTOMER_RECEIPT_POST_ERRORS];

/**
 *
 */
export type ReceiptAllocationWarningCode =
  (typeof RECEIPT_ALLOCATION_WARNING_CODES)[keyof typeof RECEIPT_ALLOCATION_WARNING_CODES];

/**
 *
 */
export interface ReceiptAllocationPolicySnapshot {
  policyId: string;
  policyCode: string;
  allocationMode: (typeof CUSTOMER_RECEIPT_ALLOCATION_MODES)[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_MODES];
  fallbackDestination: (typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS)[keyof typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS];
  requireConfirmationBeforePosting: boolean;
  allowPartialLastTarget: boolean;
  requireSameCurrency: boolean;
}

/**
 *
 */
export interface OpenBalanceTarget {
  targetType: CustomerReceiptAllocationTargetType;
  targetId: string;
  documentNo: string;
  documentDate: string | null;
  dueDate: string | null;
  outstandingAmount: number;
  currencyCode: string;
  lineRole: CustomerReceiptAllocationLineRole;
  priority: number;
  branchId: string | null;
}

/**
 *
 */
export interface ReceiptAllocationLine {
  lineRole: CustomerReceiptAllocationLineRole;
  targetType: CustomerReceiptAllocationTargetType;
  targetId: string;
  documentNo?: string;
  dueDate?: string | null;
  outstandingAmount?: number;
  allocationAmount: number;
  isPartial?: boolean;
}

/**
 *
 */
export interface ReceiptAllocationPreviewResult {
  previewId: string;
  /** Receipt currency persisted on the preview row (B15 — no defaults). */
  currencyCode?: string;
  policy: ReceiptAllocationPolicySnapshot;
  receiptAmount: number;
  currentOrderAllocationAmount: number;
  excessAmount: number;
  allocations: ReceiptAllocationLine[];
  fallbackAllocation: ReceiptAllocationLine | null;
  remainingUnallocatedAmount: number;
  warnings: Array<{ code: ReceiptAllocationWarningCode; message?: string }>;
  previewStatus: CustomerReceiptPreviewStatus;
}

export const CUSTOMER_RECEIPT_SOURCE_TYPES = {
  ORDER_PAYMENT_MODAL: VOUCHER_SOURCE_TYPES.ORDER_PAYMENT_MODAL,
  CUSTOMER_RECEIPT: VOUCHER_SOURCE_TYPES.CUSTOMER_RECEIPT,
} as const;

/**
 * Maps feature-pack / API target type to BVM voucher target_type column value.
 * @param targetType
 */
export function toVoucherTargetType(
  targetType: CustomerReceiptAllocationTargetType
): string | null {
  switch (targetType) {
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER:
      return TARGET_TYPE.ORDER;
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE:
      return TARGET_TYPE.INVOICE;
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT:
      return TARGET_TYPE.B2B_STATEMENT;
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_ADVANCE:
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.WALLET_TOPUP:
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_CREDIT:
    case CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.RETURN_CHANGE:
      return null;
    default:
      return null;
  }
}
