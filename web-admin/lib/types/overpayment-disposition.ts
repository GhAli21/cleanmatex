/**
 * Overpayment disposition types — ADR-047.
 * Explicit routing of checkout excess (change, wallet, advance, credit note).
 */

import type { OverpaymentDispositionType } from '@/lib/constants/overpayment-disposition';

/** Stable client id on each payment leg in Payment Modal V4 (not array index). */
export type PaymentLegRef = string;

export type ReturnChangeDispositionLine = {
  type: 'RETURN_CHANGE';
  /** Matches PaymentLeg.legRef in the modal payload. */
  legRef: PaymentLegRef;
  amount: number;
};

export type ToWalletDispositionLine = {
  type: 'TO_WALLET';
  amount: number;
};

export type ToAdvanceDispositionLine = {
  type: 'TO_ADVANCE';
  amount: number;
};

export type ToCreditNoteDispositionLine = {
  type: 'TO_CREDIT_NOTE';
  amount: number;
  noteReason?: string;
};

export type OverpaymentDispositionLine =
  | ReturnChangeDispositionLine
  | ToWalletDispositionLine
  | ToAdvanceDispositionLine
  | ToCreditNoteDispositionLine;

/**
 * Required on submit when server-computed excessAmount > epsilon.
 * excessAmount is authoritative on the server; client value is validated.
 */
export type OverpaymentDisposition = {
  excessAmount: number;
  lines: OverpaymentDispositionLine[];
};

/** Resolved policy for which disposition destinations are enabled at checkout. */
export type OverpaymentDestinationPolicy = {
  allowReturnChange: boolean;
  allowToWallet: boolean;
  allowToAdvance: boolean;
  allowToCreditNote: boolean;
  /** Max change per cash leg: cashTendered - applied (when change allowed). */
  changeCapacityByLegRef: Record<PaymentLegRef, number>;
};

/** Persisted row shape (org_order_overpay_disp_dtl) — for service layer I/O. */
export type OverpaymentDispositionAuditRow = {
  id: string;
  tenantOrgId: string;
  orderId: string;
  branchId: string | null;
  voucherId: string | null;
  dispositionType: OverpaymentDispositionType;
  amount: number;
  currencyCode: string;
  targetRef: string | null;
  cashLegRef: string | null;
  noteReason: string | null;
  idempotencyKey: string | null;
};
