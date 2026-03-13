/**
 * B2B Feature Constants
 */

export const INVOICE_TYPES = {
  RETAIL: 'RETAIL',
  B2B: 'B2B',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type InvoiceTypeCd = (typeof INVOICE_TYPES)[keyof typeof INVOICE_TYPES];

export const STATEMENT_STATUSES = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;

export type StatementStatusCd =
  (typeof STATEMENT_STATUSES)[keyof typeof STATEMENT_STATUSES];

export const PAYMENT_TERMS_OPTIONS = [
  { value: 0, label: 'Immediate' },
  { value: 7, label: 'Net 7' },
  { value: 14, label: 'Net 14' },
  { value: 30, label: 'Net 30' },
  { value: 60, label: 'Net 60' },
  { value: 90, label: 'Net 90' },
] as const;

export const CONTACT_ROLES = {
  PRIMARY: 'primary',
  BILLING: 'billing',
  DELIVERY: 'delivery',
  OTHER: 'other',
} as const;

export type ContactRoleCd = (typeof CONTACT_ROLES)[keyof typeof CONTACT_ROLES];

export const CREDIT_LIMIT_MODES = {
  WARN: 'warn',
  BLOCK: 'block',
} as const;

export type CreditLimitMode =
  (typeof CREDIT_LIMIT_MODES)[keyof typeof CREDIT_LIMIT_MODES];
