/**
 * Overpayment resolution types — ADR-047 / sys_fin_overpay_res_cd.
 * Authoritative posting remains on org_fin_voucher_trx_lines_dtl (BVM).
 * org_fin_overpay_disp_dtl is audit/index only.
 */

import type { OverpaymentResolutionCode } from '@/lib/constants/settlement-catalog';

/** Stable client id on each payment leg in Payment Modal V4 (not array index). */
export type PaymentLegRef = string;

/**
 *
 */
export type ReturnCashChangeResolutionLine = {
  resolutionCode: 'RETURN_CASH_CHANGE';
  legRef: PaymentLegRef;
  amount: number;
};

/**
 *
 */
export type SaveAsCustomerAdvanceResolutionLine = {
  resolutionCode: 'SAVE_AS_CUSTOMER_ADVANCE';
  amount: number;
};

/**
 *
 */
export type SaveAsCustomerCreditResolutionLine = {
  resolutionCode: 'SAVE_AS_CUSTOMER_CREDIT';
  amount: number;
  noteReason?: string;
};

/**
 *
 */
export type ReducePaymentResolutionLine = {
  resolutionCode: 'REDUCE_PAYMENT';
  amount: number;
};

/**
 *
 */
export type RestoreStoredValueResolutionLine = {
  resolutionCode: 'RESTORE_STORED_VALUE';
  amount: number;
};

/**
 *
 */
export type OverpaymentResolutionLine =
  | ReturnCashChangeResolutionLine
  | SaveAsCustomerAdvanceResolutionLine
  | SaveAsCustomerCreditResolutionLine
  | ReducePaymentResolutionLine
  | RestoreStoredValueResolutionLine;

/** Required on submit when server-computed excessAmount > epsilon (Phase 2+). */
export type OverpaymentResolution = {
  excessAmount: number;
  lines: OverpaymentResolutionLine[];
};

/** Persisted audit row (org_fin_overpay_disp_dtl). */
export type OverpaymentResolutionAuditRow = {
  id: string;
  tenantOrgId: string;
  orderId: string;
  branchId: string | null;
  voucherId: string | null;
  voucherTrxLineId: string | null;
  resolutionCode: OverpaymentResolutionCode;
  amount: number;
  currencyCode: string;
  targetRef: string | null;
  cashLegRef: string | null;
  noteReason: string | null;
  idempotencyKey: string | null;
};

/** @deprecated Use OverpaymentResolution */
export type OverpaymentDisposition = OverpaymentResolution;
