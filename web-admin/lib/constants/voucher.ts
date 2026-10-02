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

/**
 *
 */
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

/**
 *
 */
export type VoucherSubtype = (typeof VOUCHER_SUBTYPE)[keyof typeof VOUCHER_SUBTYPE];

// ── BVM constants — values mirror DB CHECK constraints exactly ────────────────

/** Final voucher_type column values (migration 0307). Mirrors chk_fin_voucher_type. */
export const VOUCHER_TYPE = {
  RECEIPT:    'RECEIPT_VOUCHER',
  PAYMENT:    'PAYMENT_VOUCHER',
  REFUND:     'REFUND_VOUCHER',
  ADJUSTMENT: 'ADJUSTMENT_VOUCHER',
  TRANSFER:   'TRANSFER_VOUCHER',
} as const;

/**
 *
 */
export type VoucherType = (typeof VOUCHER_TYPE)[keyof typeof VOUCHER_TYPE];

/** Business lifecycle status on org_fin_vouchers_mst.voucher_status. Set by BVM only. */
export const VOUCHER_STATUS = {
  DRAFT:               'DRAFT',
  POSTED:              'POSTED',
  CANCELLED:           'CANCELLED',
  REVERSED:            'REVERSED',
  PARTIALLY_REVERSED:  'PARTIALLY_REVERSED',
} as const;

/**
 *
 */
export type VoucherStatus = (typeof VOUCHER_STATUS)[keyof typeof VOUCHER_STATUS];

/** Accounting/GL posting status on org_fin_vouchers_mst.posting_status. Set by future GL service only. */
export const GL_POSTING_STATUS = {
  NOT_POSTED:     'NOT_POSTED',
  POSTED:         'POSTED',
  POSTING_FAILED: 'POSTING_FAILED',
} as const;

/**
 *
 */
export type GlPostingStatus = (typeof GL_POSTING_STATUS)[keyof typeof GL_POSTING_STATUS];

export const VOUCHER_DIRECTION = {
  IN:      'IN',
  OUT:     'OUT',
  NEUTRAL: 'NEUTRAL',
} as const;

/**
 *
 */
export type VoucherDirection = (typeof VOUCHER_DIRECTION)[keyof typeof VOUCHER_DIRECTION];

export const LINE_TYPE = {
  RECEIPT:             'RECEIPT',
  PAYMENT:             'PAYMENT',
  REFUND:              'REFUND',
  EXPENSE:             'EXPENSE',
  ADVANCE:             'ADVANCE',
  TRANSFER:            'TRANSFER',
  ADJUSTMENT:          'ADJUSTMENT',
  FEE:                 'FEE',
  ROUNDING:            'ROUNDING',
  CREDIT_APPLICATION:  'CREDIT_APPLICATION',
} as const;

/**
 *
 */
export type LineType = (typeof LINE_TYPE)[keyof typeof LINE_TYPE];

export const LINE_ROLE = {
  ORDER_PAYMENT:            'ORDER_PAYMENT',
  INVOICE_PAYMENT:          'INVOICE_PAYMENT',
  STATEMENT_PAYMENT:        'STATEMENT_PAYMENT',
  STATEMENT_CREDIT_APPLICATION: 'STATEMENT_CREDIT_APPLICATION',
  WALLET_TOPUP:             'WALLET_TOPUP',
  GIFT_CARD_SALE:           'GIFT_CARD_SALE',
  /** @deprecated Use CUSTOMER_CREDIT_ISSUE for new code. Kept for legacy rows and UI compat. */
  CUSTOMER_CREDIT_RECEIPT:  'CUSTOMER_CREDIT_RECEIPT',
  /** Canonical role for issuing customer credit from excess/compensation. */
  CUSTOMER_CREDIT_ISSUE:    'CUSTOMER_CREDIT_ISSUE',
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
  /** CLF (migration 0530): owner brings outside cash into a drawer (drawer Cash in / Cash out dialog). */
  CASH_PAY_IN:                  'CASH_PAY_IN',
  /** CLF (migration 0530): over/short adjustment from a drawer count variance; never carries a payment method. */
  CASH_OVER_SHORT:              'CASH_OVER_SHORT',
  /**
   * A6-1b (migration 0546): gap between the exact cash change owed and the rounded change
   * handed out. System-generated only (never user-selectable); direction follows the sign —
   * OUT = drawer holds less (rounding loss), IN = drawer holds more (rounding gain).
   */
  CASH_CHANGE_ROUNDING:         'CASH_CHANGE_ROUNDING',
} as const;

/**
 *
 */
export type LineRole = (typeof LINE_ROLE)[keyof typeof LINE_ROLE];

/**
 * Maps legacy line roles to canonical codes (DB accepts both during transition).
 * @param role
 */
export function normalizeVoucherLineRole(role: string): LineRole {
  const upper = role.toUpperCase();
  if (upper === LINE_ROLE.CUSTOMER_CREDIT_RECEIPT) {
    return LINE_ROLE.CUSTOMER_CREDIT_ISSUE;
  }
  return upper as LineRole;
}

export const TARGET_TYPE = {
  ORDER:        'ORDER',
  /** AR invoice — use INVOICE (not AR_INVOICE) per production BVM catalog. */
  INVOICE:      'INVOICE',
  B2B_STATEMENT: 'B2B_STATEMENT',
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

/**
 *
 */
export type TargetType = (typeof TARGET_TYPE)[keyof typeof TARGET_TYPE];

export const LINE_STATUS = {
  DRAFT:    'DRAFT',
  POSTED:   'POSTED',
  REVERSED:  'REVERSED',
  CANCELLED: 'CANCELLED',
} as const;

/**
 *
 */
export type LineStatus = (typeof LINE_STATUS)[keyof typeof LINE_STATUS];

export const WIRING_STATUS = {
  NOT_WIRED:        'NOT_WIRED',
  WIRED:            'WIRED',
  PARTIALLY_WIRED:  'PARTIALLY_WIRED',
  FAILED:           'FAILED',
  REVERSED:         'REVERSED',
} as const;

/**
 *
 */
export type WiringStatus = (typeof WIRING_STATUS)[keyof typeof WIRING_STATUS];

/**
 * Values allowed on org_fin_voucher_trx_lines_dtl.payment_status
 * (chk_vch_trx_ln_pay_status). Mirrors migration 0301; extended in 0370.
 */
export const VOUCHER_LINE_PAYMENT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  PROCESSING: 'PROCESSING',
  CAPTURE_PENDING: 'CAPTURE_PENDING',
} as const;

/**
 *
 */
export type VoucherLinePaymentStatus =
  (typeof VOUCHER_LINE_PAYMENT_STATUS)[keyof typeof VOUCHER_LINE_PAYMENT_STATUS];

const VOUCHER_LINE_PAYMENT_STATUS_ALLOWED = new Set<string>(
  Object.values(VOUCHER_LINE_PAYMENT_STATUS)
);

/**
 * Maps planner/order-payment statuses to voucher-line payment_status values.
 * PROCESSING/CAPTURE_PENDING are async gateway states — stored as PENDING on
 * voucher lines until migration 0370 is applied; after 0370 they may persist.
 * @param status
 */
export function normalizeVoucherLinePaymentStatus(
  status: string | null | undefined
): string | null {
  if (status == null || String(status).trim() === '') return null;
  const upper = String(status).trim().toUpperCase();
  if (upper === VOUCHER_LINE_PAYMENT_STATUS.PROCESSING
    || upper === VOUCHER_LINE_PAYMENT_STATUS.CAPTURE_PENDING) {
    return VOUCHER_LINE_PAYMENT_STATUS.PENDING;
  }
  if (VOUCHER_LINE_PAYMENT_STATUS_ALLOWED.has(upper)) return upper;
  return VOUCHER_LINE_PAYMENT_STATUS.PENDING;
}

export const PARTY_TYPE = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  EMPLOYEE: 'EMPLOYEE',
  OTHER:    'OTHER',
} as const;

/**
 *
 */
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
  LINE_ROLE.CUSTOMER_CREDIT_ISSUE,
  LINE_ROLE.CUSTOMER_CREDIT_RECEIPT,
] as const;

/**
 * Validation map: line_role → required target_types + required fields.
 * Used by voucher-validation.service.ts.
 */
export const LINE_ROLE_REQUIREMENTS: Record<string, { targetTypes: string[]; requiredFields: string[] }> = {
  [LINE_ROLE.ORDER_PAYMENT]:            { targetTypes: [TARGET_TYPE.ORDER],       requiredFields: ['order_id'] },
  [LINE_ROLE.INVOICE_PAYMENT]:          { targetTypes: [TARGET_TYPE.INVOICE],     requiredFields: [] },
  [LINE_ROLE.STATEMENT_PAYMENT]:        { targetTypes: [TARGET_TYPE.B2B_STATEMENT], requiredFields: [] },
  [LINE_ROLE.STATEMENT_CREDIT_APPLICATION]: { targetTypes: [TARGET_TYPE.B2B_STATEMENT], requiredFields: [] },
  [LINE_ROLE.WALLET_TOPUP]:             { targetTypes: [TARGET_TYPE.WALLET],      requiredFields: ['customer_id'] },
  [LINE_ROLE.GIFT_CARD_SALE]:           { targetTypes: [TARGET_TYPE.GIFT_CARD],   requiredFields: [] },
  [LINE_ROLE.CUSTOMER_CREDIT_ISSUE]:    { targetTypes: [TARGET_TYPE.CUSTOMER],    requiredFields: ['customer_id'] },
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
  [LINE_ROLE.CASH_PAY_IN]:              { targetTypes: [TARGET_TYPE.CASH_DRAWER], requiredFields: [] },
  [LINE_ROLE.CASH_OVER_SHORT]:          { targetTypes: [TARGET_TYPE.CASH_DRAWER], requiredFields: [] },
  // Anchored to the order the cash was taken for; payments without an order (wallet top-up,
  // customer account receipt) anchor to the customer, then to the drawer.
  [LINE_ROLE.CASH_CHANGE_ROUNDING]:     { targetTypes: [TARGET_TYPE.ORDER, TARGET_TYPE.CUSTOMER, TARGET_TYPE.CASH_DRAWER], requiredFields: [] },
};

/**
 * Canonical line_role → line_type map (single source of truth — used by the
 * generic voucher line dialog and any server-side line-creating flow, e.g.
 * the drawer "Cash in / Cash out" dialog, CLF W11).
 */
export const LINE_ROLE_TO_LINE_TYPE: Record<LineRole, LineType> = {
  [LINE_ROLE.ORDER_PAYMENT]:            LINE_TYPE.RECEIPT,
  [LINE_ROLE.INVOICE_PAYMENT]:          LINE_TYPE.RECEIPT,
  [LINE_ROLE.STATEMENT_PAYMENT]:        LINE_TYPE.RECEIPT,
  [LINE_ROLE.STATEMENT_CREDIT_APPLICATION]: LINE_TYPE.ADJUSTMENT,
  [LINE_ROLE.WALLET_TOPUP]:             LINE_TYPE.RECEIPT,
  [LINE_ROLE.GIFT_CARD_SALE]:           LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_CREDIT_RECEIPT]:  LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_CREDIT_ISSUE]:    LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT]: LINE_TYPE.RECEIPT,
  [LINE_ROLE.SUPPLIER_PAYMENT]:         LINE_TYPE.PAYMENT,
  [LINE_ROLE.EXPENSE_PAYMENT]:          LINE_TYPE.EXPENSE,
  [LINE_ROLE.SHOP_RENT_PAYMENT]:        LINE_TYPE.EXPENSE,
  [LINE_ROLE.UTILITY_PAYMENT]:          LINE_TYPE.EXPENSE,
  [LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT]: LINE_TYPE.ADVANCE,
  [LINE_ROLE.PETTY_CASH_ISSUE]:         LINE_TYPE.PAYMENT,
  [LINE_ROLE.CUSTOMER_REFUND]:          LINE_TYPE.REFUND,
  [LINE_ROLE.ORDER_REFUND]:             LINE_TYPE.REFUND,
  [LINE_ROLE.INVOICE_REFUND]:           LINE_TYPE.REFUND,
  [LINE_ROLE.PETTY_CASH_RETURN]:        LINE_TYPE.ADVANCE,
  [LINE_ROLE.WALLET_REFUND]:            LINE_TYPE.REFUND,
  [LINE_ROLE.GIFT_CARD_REFUND]:         LINE_TYPE.REFUND,
  [LINE_ROLE.INTERNAL_TRANSFER]:        LINE_TYPE.TRANSFER,
  [LINE_ROLE.ORDER_CREDIT_APPLICATION]: LINE_TYPE.ADJUSTMENT,
  [LINE_ROLE.CASH_PAY_IN]:              LINE_TYPE.RECEIPT,
  [LINE_ROLE.CASH_OVER_SHORT]:          LINE_TYPE.ADJUSTMENT,
  [LINE_ROLE.CASH_CHANGE_ROUNDING]:     LINE_TYPE.ROUNDING,
};

/** Canonical line_role → direction map (single source of truth, see LINE_ROLE_TO_LINE_TYPE). */
export const LINE_ROLE_TO_DIRECTION: Record<LineRole, VoucherDirection> = {
  [LINE_ROLE.ORDER_PAYMENT]:            VOUCHER_DIRECTION.IN,
  [LINE_ROLE.INVOICE_PAYMENT]:          VOUCHER_DIRECTION.IN,
  [LINE_ROLE.STATEMENT_PAYMENT]:        VOUCHER_DIRECTION.IN,
  [LINE_ROLE.STATEMENT_CREDIT_APPLICATION]: VOUCHER_DIRECTION.NEUTRAL,
  [LINE_ROLE.WALLET_TOPUP]:             VOUCHER_DIRECTION.IN,
  [LINE_ROLE.GIFT_CARD_SALE]:           VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_CREDIT_RECEIPT]:  VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_CREDIT_ISSUE]:    VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT]: VOUCHER_DIRECTION.IN,
  [LINE_ROLE.SUPPLIER_PAYMENT]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.EXPENSE_PAYMENT]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.SHOP_RENT_PAYMENT]:        VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.UTILITY_PAYMENT]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT]: VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.PETTY_CASH_ISSUE]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.CUSTOMER_REFUND]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.ORDER_REFUND]:             VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.INVOICE_REFUND]:           VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.PETTY_CASH_RETURN]:        VOUCHER_DIRECTION.IN,
  [LINE_ROLE.WALLET_REFUND]:            VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.GIFT_CARD_REFUND]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.INTERNAL_TRANSFER]:        VOUCHER_DIRECTION.NEUTRAL,
  [LINE_ROLE.ORDER_CREDIT_APPLICATION]: VOUCHER_DIRECTION.NEUTRAL,
  [LINE_ROLE.CASH_PAY_IN]:              VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CASH_OVER_SHORT]:          VOUCHER_DIRECTION.NEUTRAL,
  // Placeholder only: the writer sets IN/OUT from the sign of the rounding gap.
  [LINE_ROLE.CASH_CHANGE_ROUNDING]:     VOUCHER_DIRECTION.NEUTRAL,
};
