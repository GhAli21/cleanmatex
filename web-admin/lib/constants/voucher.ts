/**
 * Voucher constants for CleanMateX.
 *
 * LEGACY exports (VOUCHER_TYPE_LEGACY, VOUCHER_STATUS_LEGACY) — used by the
 * existing receipt-only billing/vouchers flow that writes to the old `status`
 * column. Do not remove until billing/vouchers is migrated to BVM.
 *
 * BVM exports (VOUCHER_TYPE, VOUCHER_STATUS, GL_POSTING_STATUS, LINE_TYPE,
 * LINE_ROLE, TARGET_TYPE, VOUCHER_DIRECTION, WIRING_STATUS) — used by all
 * new Business Voucher Module code. Values mirror DB CHECK constraints exactly.
 */

// ── Legacy: receipt-only billing/vouchers flows ───────────────────────────────

export const VOUCHER_CATEGORY = {
  CASH_IN: 'CASH_IN',
  CASH_OUT: 'CASH_OUT',
  NON_CASH: 'NON_CASH',
} as const;

export type VoucherCategory = (typeof VOUCHER_CATEGORY)[keyof typeof VOUCHER_CATEGORY];

/** @deprecated Use VOUCHER_TYPE (BVM values) for new code. */
export const VOUCHER_TYPE_LEGACY = {
  RECEIPT:    'RECEIPT',
  PAYMENT:    'PAYMENT',
  CREDIT:     'CREDIT',
  ADJUSTMENT: 'ADJUSTMENT',
  ADVANCE:    'ADVANCE',
  DEPOSIT:    'DEPOSIT',
  PENALTY:    'PENALTY',
  WRITE_OFF:  'WRITE_OFF',
} as const;

export const VOUCHER_SUBTYPE = {
  SALE_PAYMENT:     'SALE_PAYMENT',
  ADVANCE:          'ADVANCE',
  DEPOSIT:          'DEPOSIT',
  REFUND:           'REFUND',
  CREDIT_NOTE:      'CREDIT_NOTE',
  WRITE_OFF:        'WRITE_OFF',
  PRICE_CORRECTION: 'PRICE_CORRECTION',
  PENALTY_FEE:      'PENALTY_FEE',
} as const;

export type VoucherSubtype = (typeof VOUCHER_SUBTYPE)[keyof typeof VOUCHER_SUBTYPE];

/** Legacy status for the old `status` column (draft/issued/voided). */
export const VOUCHER_STATUS_LEGACY = {
  DRAFT:  'draft',
  ISSUED: 'issued',
  VOIDED: 'voided',
} as const;

export type VoucherStatusLegacy = (typeof VOUCHER_STATUS_LEGACY)[keyof typeof VOUCHER_STATUS_LEGACY];

// ── BVM constants — values mirror DB CHECK constraints exactly ────────────────

/** Final voucher_type column values (migration 0307). Mirrors chk_fin_voucher_type. */
export const VOUCHER_TYPE = {
  RECEIPT:    'RECEIPT_VOUCHER',
  PAYMENT:    'PAYMENT_VOUCHER',
  REFUND:     'REFUND_VOUCHER',
  ADJUSTMENT: 'ADJUSTMENT_VOUCHER',
  TRANSFER:   'TRANSFER_VOUCHER',
} as const;

export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

/** Business lifecycle status on org_fin_vouchers_mst.voucher_status. Set by BVM only. */
export const VOUCHER_STATUS = {
  DRAFT:               'DRAFT',
  POSTED:              'POSTED',
  CANCELLED:           'CANCELLED',
  REVERSED:            'REVERSED',
  PARTIALLY_REVERSED:  'PARTIALLY_REVERSED',
} as const;

export type VoucherStatus = (typeof VOUCHER_STATUS)[keyof typeof VOUCHER_STATUS];

/** Accounting/GL posting status on org_fin_vouchers_mst.posting_status. Set by future GL service only. */
export const GL_POSTING_STATUS = {
  NOT_POSTED:     'NOT_POSTED',
  POSTED:         'POSTED',
  POSTING_FAILED: 'POSTING_FAILED',
} as const;

export type GlPostingStatus = (typeof GL_POSTING_STATUS)[keyof typeof GL_POSTING_STATUS];

export const VOUCHER_DIRECTION = {
  IN:      'IN',
  OUT:     'OUT',
  NEUTRAL: 'NEUTRAL',
} as const;

export type VoucherDirection = (typeof VOUCHER_DIRECTION)[keyof typeof VOUCHER_DIRECTION];

export const LINE_TYPE = {
  RECEIPT:    'RECEIPT',
  PAYMENT:    'PAYMENT',
  REFUND:     'REFUND',
  EXPENSE:    'EXPENSE',
  ADVANCE:    'ADVANCE',
  TRANSFER:   'TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',
  FEE:        'FEE',
  ROUNDING:   'ROUNDING',
} as const;

export type LineType = (typeof LINE_TYPE)[keyof typeof LINE_TYPE];

export const LINE_ROLE = {
  ORDER_PAYMENT:            'ORDER_PAYMENT',
  INVOICE_PAYMENT:          'INVOICE_PAYMENT',
  WALLET_TOPUP:             'WALLET_TOPUP',
  GIFT_CARD_SALE:           'GIFT_CARD_SALE',
  CUSTOMER_CREDIT_RECEIPT:  'CUSTOMER_CREDIT_RECEIPT',
  CUSTOMER_ADVANCE_RECEIPT: 'CUSTOMER_ADVANCE_RECEIPT',
  SUPPLIER_PAYMENT:         'SUPPLIER_PAYMENT',
  EXPENSE_PAYMENT:          'EXPENSE_PAYMENT',
  SHOP_RENT_PAYMENT:        'SHOP_RENT_PAYMENT',
  UTILITY_PAYMENT:          'UTILITY_PAYMENT',
  EMPLOYEE_ADVANCE_PAYMENT: 'EMPLOYEE_ADVANCE_PAYMENT',
  PETTY_CASH_ISSUE:         'PETTY_CASH_ISSUE',
  CUSTOMER_REFUND:          'CUSTOMER_REFUND',
  ORDER_REFUND:             'ORDER_REFUND',
  INVOICE_REFUND:           'INVOICE_REFUND',
  PETTY_CASH_RETURN:        'PETTY_CASH_RETURN',
  WALLET_REFUND:            'WALLET_REFUND',
  GIFT_CARD_REFUND:             'GIFT_CARD_REFUND',
  INTERNAL_TRANSFER:            'INTERNAL_TRANSFER',
  ORDER_CREDIT_APPLICATION:     'ORDER_CREDIT_APPLICATION',
} as const;

export type LineRole = (typeof LINE_ROLE)[keyof typeof LINE_ROLE];

export const TARGET_TYPE = {
  ORDER:        'ORDER',
  INVOICE:      'INVOICE',
  CUSTOMER:     'CUSTOMER',
  SUPPLIER:     'SUPPLIER',
  EMPLOYEE:     'EMPLOYEE',
  WALLET:       'WALLET',
  GIFT_CARD:    'GIFT_CARD',
  CREDIT_NOTE:  'CREDIT_NOTE',
  EXPENSE:      'EXPENSE',
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  CASH_DRAWER:  'CASH_DRAWER',
  PETTY_CASH:   'PETTY_CASH',
  OTHER:        'OTHER',
} as const;

export type TargetType = (typeof TARGET_TYPE)[keyof typeof TARGET_TYPE];

export const LINE_STATUS = {
  DRAFT:    'DRAFT',
  POSTED:   'POSTED',
  REVERSED: 'REVERSED',
  VOIDED:   'VOIDED',
} as const;

export type LineStatus = (typeof LINE_STATUS)[keyof typeof LINE_STATUS];

export const WIRING_STATUS = {
  NOT_WIRED:        'NOT_WIRED',
  WIRED:            'WIRED',
  PARTIALLY_WIRED:  'PARTIALLY_WIRED',
  FAILED:           'FAILED',
  REVERSED:         'REVERSED',
} as const;

export type WiringStatus = (typeof WIRING_STATUS)[keyof typeof WIRING_STATUS];

export const PARTY_TYPE = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  EMPLOYEE: 'EMPLOYEE',
  OTHER:    'OTHER',
} as const;

export type PartyType = (typeof PARTY_TYPE)[keyof typeof PARTY_TYPE];

/**
 * Roles/voucher types allowed for the cashier role.
 * Enforced at service layer (validateRoleForUser) and used by UI to filter options.
 */
export const CASHIER_ALLOWED_VOUCHER_TYPES = [VOUCHER_TYPE.RECEIPT] as const;

export const CASHIER_ALLOWED_LINE_ROLES = [
  LINE_ROLE.ORDER_PAYMENT,
  LINE_ROLE.ORDER_CREDIT_APPLICATION,
  LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
  LINE_ROLE.WALLET_TOPUP,
  LINE_ROLE.GIFT_CARD_SALE,
  LINE_ROLE.CUSTOMER_CREDIT_RECEIPT,
] as const;

/**
 * Validation map: line_role → required target_types + required fields.
 * Used by voucher-validation.service.ts.
 */
export const LINE_ROLE_REQUIREMENTS: Record<string, { targetTypes: string[]; requiredFields: string[] }> = {
  [LINE_ROLE.ORDER_PAYMENT]:            { targetTypes: [TARGET_TYPE.ORDER],       requiredFields: ['order_id'] },
  [LINE_ROLE.INVOICE_PAYMENT]:          { targetTypes: [TARGET_TYPE.INVOICE],     requiredFields: [] },
  [LINE_ROLE.WALLET_TOPUP]:             { targetTypes: [TARGET_TYPE.WALLET],      requiredFields: ['customer_id'] },
  [LINE_ROLE.GIFT_CARD_SALE]:           { targetTypes: [TARGET_TYPE.GIFT_CARD],   requiredFields: [] },
  [LINE_ROLE.CUSTOMER_CREDIT_RECEIPT]:  { targetTypes: [TARGET_TYPE.CUSTOMER],    requiredFields: ['customer_id'] },
  [LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT]: { targetTypes: [TARGET_TYPE.CUSTOMER],    requiredFields: ['customer_id'] },
  [LINE_ROLE.SUPPLIER_PAYMENT]:         { targetTypes: [TARGET_TYPE.SUPPLIER],    requiredFields: ['party_name'] },
  [LINE_ROLE.EXPENSE_PAYMENT]:          { targetTypes: [TARGET_TYPE.EXPENSE],     requiredFields: ['expense_category_code'] },
  [LINE_ROLE.SHOP_RENT_PAYMENT]:        { targetTypes: [TARGET_TYPE.EXPENSE],     requiredFields: ['expense_category_code'] },
  [LINE_ROLE.UTILITY_PAYMENT]:          { targetTypes: [TARGET_TYPE.EXPENSE],     requiredFields: ['expense_category_code'] },
  [LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT]: { targetTypes: [TARGET_TYPE.EMPLOYEE],    requiredFields: ['employee_id'] },
  [LINE_ROLE.PETTY_CASH_ISSUE]:         { targetTypes: [TARGET_TYPE.PETTY_CASH],  requiredFields: [] },
  [LINE_ROLE.CUSTOMER_REFUND]:          { targetTypes: [TARGET_TYPE.CUSTOMER],    requiredFields: ['customer_id'] },
  [LINE_ROLE.ORDER_REFUND]:             { targetTypes: [TARGET_TYPE.ORDER],       requiredFields: ['order_id'] },
  [LINE_ROLE.INVOICE_REFUND]:           { targetTypes: [TARGET_TYPE.INVOICE],     requiredFields: [] },
  [LINE_ROLE.PETTY_CASH_RETURN]:        { targetTypes: [TARGET_TYPE.PETTY_CASH],  requiredFields: [] },
  [LINE_ROLE.WALLET_REFUND]:            { targetTypes: [TARGET_TYPE.WALLET],      requiredFields: ['customer_id'] },
  [LINE_ROLE.GIFT_CARD_REFUND]:         { targetTypes: [TARGET_TYPE.GIFT_CARD],   requiredFields: [] },
  [LINE_ROLE.INTERNAL_TRANSFER]:        { targetTypes: [TARGET_TYPE.CASH_DRAWER], requiredFields: [] },
  [LINE_ROLE.ORDER_CREDIT_APPLICATION]: { targetTypes: [TARGET_TYPE.ORDER],       requiredFields: ['order_id'] },
};
