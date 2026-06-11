/**
 * CleanMateX Customer Receipt Auto Allocation Constants and Types
 * Version: v1.0
 */

export const OVERPAYMENT_RESOLUTION_CODES = {
  REDUCE_PAYMENT: 'REDUCE_PAYMENT',
  RETURN_CASH_CHANGE: 'RETURN_CASH_CHANGE',
  VOID_OR_REFUND_EXCESS: 'VOID_OR_REFUND_EXCESS',
  SAVE_AS_CUSTOMER_ADVANCE: 'SAVE_AS_CUSTOMER_ADVANCE',
  SAVE_AS_CUSTOMER_CREDIT: 'SAVE_AS_CUSTOMER_CREDIT',
  RESTORE_STORED_VALUE: 'RESTORE_STORED_VALUE',
  ALLOCATE_TO_CUSTOMER_BALANCES: 'ALLOCATE_TO_CUSTOMER_BALANCES',
  AUTO_ALLOCATE_TO_CUSTOMER_BALANCES: 'AUTO_ALLOCATE_TO_CUSTOMER_BALANCES',
} as const;

export const CUSTOMER_RECEIPT_ALLOCATION_MODES = {
  AUTO_OLDEST_DUE: 'AUTO_OLDEST_DUE',
  AUTO_OLDEST_DOCUMENT: 'AUTO_OLDEST_DOCUMENT',
  AUTO_PRIORITY_THEN_OLDEST: 'AUTO_PRIORITY_THEN_OLDEST',
  MANUAL_ONLY: 'MANUAL_ONLY',
} as const;

export const CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS = {
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  RETURN_CHANGE: 'RETURN_CHANGE',
  BLOCK_AND_REQUIRE_MANUAL_ACTION: 'BLOCK_AND_REQUIRE_MANUAL_ACTION',
} as const;

export const CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES = {
  ORDER: 'ORDER',
  AR_INVOICE: 'AR_INVOICE',
  B2B_STATEMENT: 'B2B_STATEMENT',
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_CREDIT: 'CUSTOMER_CREDIT',
  RETURN_CHANGE: 'RETURN_CHANGE',
} as const;

export const CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES = {
  ORDER_PAYMENT: 'ORDER_PAYMENT',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  STATEMENT_PAYMENT: 'STATEMENT_PAYMENT',
  CUSTOMER_ADVANCE_RECEIPT: 'CUSTOMER_ADVANCE_RECEIPT',
  WALLET_TOPUP: 'WALLET_TOPUP',
  CUSTOMER_CREDIT_ISSUE: 'CUSTOMER_CREDIT_ISSUE',
} as const;

export const CUSTOMER_RECEIPT_PREVIEW_STATUSES = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  POSTED: 'POSTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export const RECEIPT_ALLOCATION_WARNING_CODES = {
  RECEIPT_ALLOCATION_UNBALANCED: 'RECEIPT_ALLOCATION_UNBALANCED',
  RECEIPT_ALLOCATION_TARGET_PAID: 'RECEIPT_ALLOCATION_TARGET_PAID',
  RECEIPT_ALLOCATION_TARGET_CURRENCY_MISMATCH: 'RECEIPT_ALLOCATION_TARGET_CURRENCY_MISMATCH',
  RECEIPT_ALLOCATION_ORDER_HAS_AR_INVOICE: 'RECEIPT_ALLOCATION_ORDER_HAS_AR_INVOICE',
  RECEIPT_ALLOCATION_FALLBACK_REQUIRED: 'RECEIPT_ALLOCATION_FALLBACK_REQUIRED',
  RECEIPT_ALLOCATION_POLICY_MISSING: 'RECEIPT_ALLOCATION_POLICY_MISSING',
  RECEIPT_ALLOCATION_EXCESS_UNRESOLVED: 'RECEIPT_ALLOCATION_EXCESS_UNRESOLVED',
  RECEIPT_ALLOCATION_IDEMPOTENCY_CONFLICT: 'RECEIPT_ALLOCATION_IDEMPOTENCY_CONFLICT',
} as const;

export type CustomerReceiptAllocationMode = typeof CUSTOMER_RECEIPT_ALLOCATION_MODES[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_MODES];
export type CustomerReceiptFallbackDestination = typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS[keyof typeof CUSTOMER_RECEIPT_FALLBACK_DESTINATIONS];
export type CustomerReceiptAllocationTargetType = typeof CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES];
export type CustomerReceiptAllocationLineRole = typeof CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES[keyof typeof CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES];

export type MoneyInput = { amount: string; currencyCode: string };

export type CustomerOpenBalanceTarget = {
  targetType: CustomerReceiptAllocationTargetType;
  targetId: string;
  documentNo: string;
  documentDate: string | null;
  dueDate: string | null;
  status: string;
  outstandingAmount: MoneyInput;
  lineRole: CustomerReceiptAllocationLineRole;
  priority: number;
  customerId: string;
  branchId?: string | null;
  contractId?: string | null;
};

export type CustomerReceiptAllocationLine = {
  lineRole: CustomerReceiptAllocationLineRole;
  targetType: CustomerReceiptAllocationTargetType;
  targetId: string | null;
  documentNo?: string;
  amount: MoneyInput;
  isPartial?: boolean;
  sourceOutstandingAmount?: MoneyInput;
};

export type CustomerReceiptAllocationPreview = {
  previewId?: string;
  policyCode: string;
  allocationMode: CustomerReceiptAllocationMode;
  fallbackDestination: CustomerReceiptFallbackDestination;
  receiptAmount: MoneyInput;
  currentOrderAllocationAmount: MoneyInput;
  excessAmount: MoneyInput;
  allocations: CustomerReceiptAllocationLine[];
  fallbackAllocation?: CustomerReceiptAllocationLine | null;
  remainingUnallocatedAmount: MoneyInput;
  warnings: Array<{ code: string; message: string; blocking: boolean }>;
};
