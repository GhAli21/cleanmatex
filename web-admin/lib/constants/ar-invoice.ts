/**
 * AR Invoice domain constants.
 *
 * These values mirror the canonical DB codes introduced by AR Invoice v1.
 * Keep every persisted string exactly aligned with the database values.
 */

export const AR_INVOICE_DOC_TYPES = {
  AR_INV: 'AR_INV',
} as const;

/**
 *
 */
export type ArInvoiceDocType = (typeof AR_INVOICE_DOC_TYPES)[keyof typeof AR_INVOICE_DOC_TYPES];

export const AR_INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  VOID: 'VOID',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  WRITTEN_OFF: 'WRITTEN_OFF',
  DISPUTED: 'DISPUTED',
} as const;

/**
 *
 */
export type ArInvoiceStatus =
  (typeof AR_INVOICE_STATUSES)[keyof typeof AR_INVOICE_STATUSES];

export const LEGACY_INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
} as const;

/**
 *
 */
export type LegacyInvoiceStatus =
  (typeof LEGACY_INVOICE_STATUSES)[keyof typeof LEGACY_INVOICE_STATUSES];

export const AR_INVOICE_TYPES = {
  ORDER_CREDIT: 'ORDER_CREDIT',
  B2B_ORDER: 'B2B_ORDER',
  B2B_STATEMENT: 'B2B_STATEMENT',
  MANUAL_AR: 'MANUAL_AR',
  CREDIT_MEMO: 'CREDIT_MEMO',
  DEBIT_NOTE: 'DEBIT_NOTE',
  PROFORMA: 'PROFORMA',
} as const;

/**
 *
 */
export type ArInvoiceType =
  (typeof AR_INVOICE_TYPES)[keyof typeof AR_INVOICE_TYPES];

export const AR_ALLOCATION_OUTCOMES = {
  APPLIED: 'APPLIED',
  PARTIAL: 'PARTIAL',
  UNAPPLIED_CREDIT: 'UNAPPLIED_CREDIT',
  REVERSED: 'REVERSED',
} as const;

/**
 *
 */
export type ArAllocationOutcome =
  (typeof AR_ALLOCATION_OUTCOMES)[keyof typeof AR_ALLOCATION_OUTCOMES];

export const AR_SENSITIVE_APPROVAL_ACTIONS = {
  APPROVE_CREDIT_MEMO: 'APPROVE_CREDIT_MEMO',
  APPROVE_DEBIT_NOTE: 'APPROVE_DEBIT_NOTE',
  APPROVE_WRITE_OFF: 'APPROVE_WRITE_OFF',
  APPROVE_VOID: 'APPROVE_VOID',
} as const;

/**
 *
 */
export type ArSensitiveApprovalAction =
  (typeof AR_SENSITIVE_APPROVAL_ACTIONS)[keyof typeof AR_SENSITIVE_APPROVAL_ACTIONS];

export const AR_ADJUSTMENT_TYPES = {
  WRITE_OFF: 'WRITE_OFF',
  ROUNDING: 'ROUNDING',
  PENALTY: 'PENALTY',
  FINANCE_CHARGE: 'FINANCE_CHARGE',
  MANUAL_CORRECTION: 'MANUAL_CORRECTION',
  CREDIT_ADJUSTMENT: 'CREDIT_ADJUSTMENT',
  DEBIT_ADJUSTMENT: 'DEBIT_ADJUSTMENT',
} as const;

/**
 *
 */
export type ArAdjustmentType =
  (typeof AR_ADJUSTMENT_TYPES)[keyof typeof AR_ADJUSTMENT_TYPES];

export const AR_ADJUSTMENT_STATUSES = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  POSTED: 'POSTED',
  VOID: 'VOID',
} as const;

/**
 *
 */
export type ArAdjustmentStatus =
  (typeof AR_ADJUSTMENT_STATUSES)[keyof typeof AR_ADJUSTMENT_STATUSES];

export const AR_LEDGER_MOVEMENTS = {
  INVOICE_ISSUED: 'INVOICE_ISSUED',
  PAYMENT_APPLIED: 'PAYMENT_APPLIED',
  OVERPAY_CREDIT: 'OVERPAY_CREDIT',
  CREDIT_MEMO: 'CREDIT_MEMO',
  DEBIT_NOTE: 'DEBIT_NOTE',
  WRITE_OFF: 'WRITE_OFF',
  PAYMENT_REVERSED: 'PAYMENT_REVERSED',
  ADJUSTMENT: 'ADJUSTMENT',
  VOID: 'VOID',
} as const;

/**
 *
 */
export type ArLedgerMovement =
  (typeof AR_LEDGER_MOVEMENTS)[keyof typeof AR_LEDGER_MOVEMENTS];

export const AR_LEDGER_ENTRY_SIDES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

/**
 *
 */
export type ArLedgerEntrySide =
  (typeof AR_LEDGER_ENTRY_SIDES)[keyof typeof AR_LEDGER_ENTRY_SIDES];

export const AR_DUE_DATE_SOURCES = {
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
  B2B_CONTRACT: 'B2B_CONTRACT',
  CUSTOMER_TERMS: 'CUSTOMER_TERMS',
  BRANCH_DEFAULT: 'BRANCH_DEFAULT',
  INVOICE_DATE: 'INVOICE_DATE',
} as const;

/**
 *
 */
export type ArDueDateSource =
  (typeof AR_DUE_DATE_SOURCES)[keyof typeof AR_DUE_DATE_SOURCES];

export const AR_CREDIT_ALLOCATION_STATUSES = {
  APPLIED: 'APPLIED',
  REVERSED: 'REVERSED',
} as const;

/**
 *
 */
export type ArCreditAllocationStatus =
  (typeof AR_CREDIT_ALLOCATION_STATUSES)[keyof typeof AR_CREDIT_ALLOCATION_STATUSES];

export const AR_DISPUTE_STATUSES = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

/**
 *
 */
export type ArDisputeStatus =
  (typeof AR_DISPUTE_STATUSES)[keyof typeof AR_DISPUTE_STATUSES];

export const AR_DUNNING_STAGES = {
  REMINDER_1: 'REMINDER_1',
  REMINDER_2: 'REMINDER_2',
  FINAL_NOTICE: 'FINAL_NOTICE',
  CREDIT_HOLD: 'CREDIT_HOLD',
} as const;

/**
 *
 */
export type ArDunningStage =
  (typeof AR_DUNNING_STAGES)[keyof typeof AR_DUNNING_STAGES];

export const AR_DUNNING_ACTIONS = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  HOLD: 'HOLD',
  NOTE: 'NOTE',
} as const;

/**
 *
 */
export type ArDunningAction =
  (typeof AR_DUNNING_ACTIONS)[keyof typeof AR_DUNNING_ACTIONS];

export const AR_DUNNING_RUN_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
} as const;

/**
 *
 */
export type ArDunningRunStatus =
  (typeof AR_DUNNING_RUN_STATUSES)[keyof typeof AR_DUNNING_RUN_STATUSES];

export const AR_STATEMENT_CADENCES = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM: 'CUSTOM',
} as const;

/**
 *
 */
export type ArStatementCadence =
  (typeof AR_STATEMENT_CADENCES)[keyof typeof AR_STATEMENT_CADENCES];

export const AR_STATEMENT_CUSTOMER_SCOPES = {
  ALL_B2B: 'ALL_B2B',
  CUSTOM_LIST: 'CUSTOM_LIST',
} as const;

/**
 *
 */
export type ArStatementCustomerScope =
  (typeof AR_STATEMENT_CUSTOMER_SCOPES)[keyof typeof AR_STATEMENT_CUSTOMER_SCOPES];

export const AR_STATUS_TRANSLATION_KEYS: Record<ArInvoiceStatus, string> = {
  DRAFT: 'draft',
  OPEN: 'pending',
  PARTIALLY_PAID: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  VOID: 'cancelled',
  PARTIALLY_REFUNDED: 'refunded',
  REFUNDED: 'refunded',
  WRITTEN_OFF: 'cancelled',
  DISPUTED: 'pending',
};

export const LEGACY_TO_AR_INVOICE_STATUS: Record<string, ArInvoiceStatus> = {
  draft: AR_INVOICE_STATUSES.DRAFT,
  pending: AR_INVOICE_STATUSES.OPEN,
  partial: AR_INVOICE_STATUSES.PARTIALLY_PAID,
  paid: AR_INVOICE_STATUSES.PAID,
  overdue: AR_INVOICE_STATUSES.OVERDUE,
  cancelled: AR_INVOICE_STATUSES.CANCELLED,
  canceled: AR_INVOICE_STATUSES.CANCELLED,
  refunded: AR_INVOICE_STATUSES.REFUNDED,
  voided: AR_INVOICE_STATUSES.VOID,
  void: AR_INVOICE_STATUSES.VOID,
  partial_refunded: AR_INVOICE_STATUSES.PARTIALLY_REFUNDED,
  partially_refunded: AR_INVOICE_STATUSES.PARTIALLY_REFUNDED,
  written_off: AR_INVOICE_STATUSES.WRITTEN_OFF,
  disputed: AR_INVOICE_STATUSES.DISPUTED,
  open: AR_INVOICE_STATUSES.OPEN,
};

export const AR_STATUS_BADGE_TONES: Record<ArInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  OPEN: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  VOID: 'bg-gray-200 text-gray-900',
  PARTIALLY_REFUNDED: 'bg-fuchsia-100 text-fuchsia-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
  WRITTEN_OFF: 'bg-slate-200 text-slate-900',
  DISPUTED: 'bg-amber-100 text-amber-900',
};

/**
 *
 * @param value
 */
export function normalizeArInvoiceStatus(value?: string | null): ArInvoiceStatus {
  const normalized = value?.trim();
  if (!normalized) {
    return AR_INVOICE_STATUSES.OPEN;
  }

  if (Object.values(AR_INVOICE_STATUSES).includes(normalized as ArInvoiceStatus)) {
    return normalized as ArInvoiceStatus;
  }

  const legacy = LEGACY_TO_AR_INVOICE_STATUS[normalized.toLowerCase()];
  return legacy ?? AR_INVOICE_STATUSES.OPEN;
}

/**
 *
 * @param value
 */
export function getArInvoiceStatusTranslationKey(value?: string | null): string {
  return AR_STATUS_TRANSLATION_KEYS[normalizeArInvoiceStatus(value)];
}

/**
 *
 * @param value
 */
export function isArInvoiceSettledStatus(value?: string | null): boolean {
  const status = normalizeArInvoiceStatus(value);
  return (
    status === AR_INVOICE_STATUSES.PAID ||
    status === AR_INVOICE_STATUSES.REFUNDED ||
    status === AR_INVOICE_STATUSES.VOID ||
    status === AR_INVOICE_STATUSES.WRITTEN_OFF
  );
}

/**
 *
 * @param value
 */
export function isArInvoiceOpenBalanceStatus(value?: string | null): boolean {
  const status = normalizeArInvoiceStatus(value);
  return (
    status === AR_INVOICE_STATUSES.OPEN ||
    status === AR_INVOICE_STATUSES.PARTIALLY_PAID ||
    status === AR_INVOICE_STATUSES.OVERDUE ||
    status === AR_INVOICE_STATUSES.DISPUTED
  );
}

/**
 *
 * @param params
 * @param params.currentStatus
 * @param params.totalAmount
 * @param params.paidAmount
 * @param params.dueDate
 */
export function deriveArInvoiceStatus(params: {
  currentStatus?: string | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  dueDate?: Date | string | null;
}): ArInvoiceStatus {
  const currentStatus = normalizeArInvoiceStatus(params.currentStatus);

  if (
    currentStatus === AR_INVOICE_STATUSES.CANCELLED ||
    currentStatus === AR_INVOICE_STATUSES.VOID ||
    currentStatus === AR_INVOICE_STATUSES.REFUNDED ||
    currentStatus === AR_INVOICE_STATUSES.PARTIALLY_REFUNDED ||
    currentStatus === AR_INVOICE_STATUSES.WRITTEN_OFF ||
    currentStatus === AR_INVOICE_STATUSES.DISPUTED
  ) {
    return currentStatus;
  }

  const totalAmount = Number(params.totalAmount ?? 0);
  const paidAmount = Number(params.paidAmount ?? 0);
  const outstanding = Math.max(0, totalAmount - paidAmount);
  const dueDate = params.dueDate ? new Date(params.dueDate) : null;
  // Compare date-only strings (UTC) so that invoices due today are OPEN, not OVERDUE.
  // A datetime vs. timestamp comparison would flip today's invoices to OVERDUE immediately.
  const isPastDue =
    !!dueDate &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

  if (currentStatus === AR_INVOICE_STATUSES.DRAFT) {
    return AR_INVOICE_STATUSES.DRAFT;
  }

  if (totalAmount > 0 && outstanding <= 0) {
    return AR_INVOICE_STATUSES.PAID;
  }

  if (paidAmount > 0 && outstanding > 0) {
    return isPastDue ? AR_INVOICE_STATUSES.OVERDUE : AR_INVOICE_STATUSES.PARTIALLY_PAID;
  }

  return isPastDue ? AR_INVOICE_STATUSES.OVERDUE : AR_INVOICE_STATUSES.OPEN;
}
