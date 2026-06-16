import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';
import type { ExtraReceiptHandlingMode } from './extra-receipt-handling-card';

export type BuildOverpaymentResolutionOptions = {
  allocationPreviewId?: string | null;
  noteReason?: string;
  /** Required for RETURN_CASH_CHANGE — stable cash leg UUID from ensurePaymentLegRefs. */
  cashLegRef?: string | null;
};

/**
 * Builds submit-order overpaymentResolution when cashier chose stored-value routing.
 * Returns undefined when user must adjust leg amounts instead.
 */
export function buildOverpaymentResolutionPayload(
  mode: ExtraReceiptHandlingMode,
  excessAmount: number,
  options: BuildOverpaymentResolutionOptions = {}
): OverpaymentResolutionInput | undefined {
  const { allocationPreviewId, noteReason, cashLegRef } = options;

  if (excessAmount <= 0.001 || mode === 'adjust_legs') {
    return undefined;
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE) {
    const legRef = cashLegRef?.trim();
    if (!legRef) return undefined;
    return {
      excessAmount,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE,
          legRef,
          amount: excessAmount,
        },
      ],
    };
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES) {
    if (!allocationPreviewId) return undefined;
    return {
      excessAmount,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
          amount: excessAmount,
          allocationPreviewId,
        },
      ],
    };
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES) {
    if (!allocationPreviewId) return undefined;
    return {
      excessAmount,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES,
          amount: excessAmount,
          allocationPreviewId,
        },
      ],
    };
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE) {
    return {
      excessAmount,
      lines: [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE, amount: excessAmount }],
    };
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET) {
    return {
      excessAmount,
      lines: [{ resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET, amount: excessAmount }],
    };
  }

  if (mode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT) {
    return {
      excessAmount,
      lines: [
        {
          resolutionCode: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
          amount: excessAmount,
          ...(noteReason?.trim() ? { noteReason: noteReason.trim() } : {}),
        },
      ],
    };
  }

  return undefined;
}
