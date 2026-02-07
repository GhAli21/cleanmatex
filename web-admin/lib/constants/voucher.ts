/**
 * Voucher constants for CleanMateX finance vouchers.
 * Single source of truth for voucher_category, voucher_type, voucher_subtype.
 */

export const VOUCHER_CATEGORY = {
  CASH_IN: 'CASH_IN',
  CASH_OUT: 'CASH_OUT',
  NON_CASH: 'NON_CASH',
} as const;

export type VoucherCategory = (typeof VOUCHER_CATEGORY)[keyof typeof VOUCHER_CATEGORY];

export const VOUCHER_TYPE = {
  RECEIPT: 'RECEIPT',
  PAYMENT: 'PAYMENT',
  CREDIT: 'CREDIT',
  ADJUSTMENT: 'ADJUSTMENT',
  ADVANCE: 'ADVANCE',
  DEPOSIT: 'DEPOSIT',
  PENALTY: 'PENALTY',
  WRITE_OFF: 'WRITE_OFF',
} as const;

export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

export const VOUCHER_SUBTYPE = {
  SALE_PAYMENT: 'SALE_PAYMENT',
  ADVANCE: 'ADVANCE',
  DEPOSIT: 'DEPOSIT',
  REFUND: 'REFUND',
  CREDIT_NOTE: 'CREDIT_NOTE',
  WRITE_OFF: 'WRITE_OFF',
  PRICE_CORRECTION: 'PRICE_CORRECTION',
  PENALTY_FEE: 'PENALTY_FEE',
} as const;

export type VoucherSubtype = (typeof VOUCHER_SUBTYPE)[keyof typeof VOUCHER_SUBTYPE];

export const VOUCHER_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  VOIDED: 'voided',
} as const;

export type VoucherStatus = (typeof VOUCHER_STATUS)[keyof typeof VOUCHER_STATUS];
