/**
 * Overpayment disposition codes — ADR-047.
 * Values mirror org_order_overpay_disp_dtl.disposition_type CHECK constraint.
 */

export const OVERPAYMENT_DISPOSITION_TYPES = {
  RETURN_CHANGE: 'RETURN_CHANGE',
  TO_WALLET: 'TO_WALLET',
  TO_ADVANCE: 'TO_ADVANCE',
  TO_CREDIT_NOTE: 'TO_CREDIT_NOTE',
} as const;

export type OverpaymentDispositionType =
  (typeof OVERPAYMENT_DISPOSITION_TYPES)[keyof typeof OVERPAYMENT_DISPOSITION_TYPES];

/** Money epsilon for disposition sum vs excessAmount (matches payment leg sum tolerance). */
export const OVERPAYMENT_DISPOSITION_MONEY_EPSILON = 0.001;

/** Submit-order / planner error codes for disposition validation. */
export const OVERPAYMENT_DISPOSITION_ERROR_CODES = {
  REQUIRED: 'OVERPAYMENT_DISPOSITION_REQUIRED',
  MISMATCH: 'OVERPAYMENT_DISPOSITION_MISMATCH',
  NOT_ALLOWED: 'OVERPAYMENT_DISPOSITION_NOT_ALLOWED',
  RETURN_CHANGE_EXCEEDS_CAPACITY: 'RETURN_CHANGE_EXCEEDS_CAPACITY',
  RETURN_CHANGE_LEG_INVALID: 'RETURN_CHANGE_LEG_INVALID',
} as const;

export type OverpaymentDispositionErrorCode =
  (typeof OVERPAYMENT_DISPOSITION_ERROR_CODES)[keyof typeof OVERPAYMENT_DISPOSITION_ERROR_CODES];

/** RBAC permission codes seeded in 0354_order_overpay_disposition.sql */
export const OVERPAYMENT_DISPOSITION_PERMISSIONS = {
  DISPOSE: 'orders:overpayment_dispose',
  TO_WALLET: 'orders:overpayment_to_wallet',
  TO_ADVANCE: 'orders:overpayment_to_advance',
  TO_CREDIT_NOTE: 'orders:overpayment_to_credit_note',
} as const;
