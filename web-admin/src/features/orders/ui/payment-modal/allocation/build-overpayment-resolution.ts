import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';
import type { ExtraReceiptHandlingMode } from './extra-receipt-handling-card';

export type BuildOverpaymentResolutionOptions = {
  allocationPreviewId?: string | null;
  noteReason?: string;
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
  const { allocationPreviewId, noteReason } = options;

  if (excessAmount <= 0.001 || mode === 'adjust_legs') {
    return undefined;
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
