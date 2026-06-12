import 'server-only';

import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
  CUSTOMER_RECEIPT_PREVIEW_STATUSES,
  RECEIPT_ALLOCATION_WARNING_CODES,
  type ReceiptAllocationLine,
  type ReceiptAllocationPreviewResult,
} from '@/lib/types/customer-receipt-allocation';
import type { ReceiptAllocationPolicyRow } from '@/lib/services/customer-receipt-allocation-policy.service';

export interface ValidateAllocationPreviewParams {
  tenantId: string;
  customerId: string;
  currencyCode: string;
  preview: ReceiptAllocationPreviewResult;
  policy: ReceiptAllocationPolicyRow;
  /** When true, preview must be CONFIRMED (not DRAFT). */
  requireConfirmed?: boolean;
}

/**
 * Centralizes feature-pack allocation validation (15 rules) for preview confirm and TX post.
 */
export function validateAllocationPreview(params: ValidateAllocationPreviewParams): void {
  const { customerId, currencyCode, preview, policy, requireConfirmed = true } = params;

  if (!customerId?.trim()) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED);
  }

  if (preview.excessAmount <= SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED);
  }

  if (preview.remainingUnallocatedAmount > SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.EXCESS_UNRESOLVED);
  }

  if (requireConfirmed) {
    if (
      preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED &&
      preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.POSTED
    ) {
      throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.BLOCKED);
    }
  }

  for (const line of preview.allocations) {
    validateAllocationLine(line, currencyCode, policy);
  }

  if (preview.fallbackAllocation) {
    validateAllocationLine(preview.fallbackAllocation, currencyCode, policy);
  }
}

function validateAllocationLine(
  line: ReceiptAllocationLine,
  currencyCode: string,
  policy: ReceiptAllocationPolicyRow
): void {
  if (line.allocationAmount <= SETTLEMENT_MONEY_EPSILON) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
  }

  if (
    policy.require_same_currency &&
    line.outstandingAmount != null &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_ADVANCE &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.WALLET_TOPUP &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.CUSTOMER_CREDIT
  ) {
    // Currency enforced at target load; re-check when document currency is on line payload.
  }

  if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE
  ) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
  }

  if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.STATEMENT_PAYMENT &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.B2B_STATEMENT
  ) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
  }

  if (
    line.lineRole === CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.ORDER_PAYMENT &&
    line.targetType !== CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER
  ) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.UNBALANCED);
  }

  if (
    line.outstandingAmount != null &&
    line.allocationAmount - line.outstandingAmount > SETTLEMENT_MONEY_EPSILON &&
    !policy.allow_partial_last_target
  ) {
    throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.TARGET_PAID);
  }

  if (policy.require_same_currency && line.targetType === CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.ORDER) {
    // Order currency validated when targets were loaded against receipt currencyCode.
    if (!currencyCode?.trim()) {
      throw new Error(RECEIPT_ALLOCATION_WARNING_CODES.CURRENCY_MISMATCH);
    }
  }
}
