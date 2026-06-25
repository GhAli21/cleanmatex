import 'server-only';

import {
  OVERPAYMENT_RESOLUTIONS,
  OVERPAYMENT_RESOLUTION_ERROR_CODES,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { computeSettlementOverpaymentMetrics } from '@/lib/payments/settlement-overpayment';
import { getAllocationPreview } from '@/lib/services/customer-receipt-allocation-preview.service';
import type { SettlementPlan } from '@/lib/types/settlement-plan';
import { CUSTOMER_RECEIPT_PREVIEW_STATUSES } from '@/lib/types/customer-receipt-allocation';
import type {
  OverpaymentResolutionInput,
  PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';

const PHASE4_RESOLUTIONS = new Set<string>([
  OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES,
  OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES,
]);

/**
 *
 */
export interface OverpaymentResolutionValidationContext {
  paymentLegs?: PaymentLeg[];
  customerId?: string | null;
  tenantId?: string;
}

/**
 * Validates checkout excess routing against ADR-047.
 * Call after buildSettlementPlan + validateSettlementPlan infrastructure checks.
 * @param plan
 * @param resolution
 * @param context
 */
export async function validateOverpaymentResolution(
  plan: SettlementPlan,
  resolution: OverpaymentResolutionInput | undefined,
  context: OverpaymentResolutionValidationContext = {}
): Promise<void> {
  const eps = SETTLEMENT_MONEY_EPSILON;

  const explicitChangeResolved =
    resolution?.lines
      .filter((line) => line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE)
      .reduce((sum, line) => sum + line.amount, 0) ?? 0;

  const hasStoredValueDisposition = resolution?.lines.some(
    (line) =>
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE ||
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET ||
      line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT ||
      PHASE4_RESOLUTIONS.has(line.resolutionCode)
  );

  const payExtraIntent =
    explicitChangeResolved > eps || hasStoredValueDisposition === true;

  const metrics = computeSettlementOverpaymentMetrics(plan, eps, {
    payExtraIntent,
    explicitChangeResolved,
  });
  const { unresolvedExcessAmount, cashChangeCapacity, canReturnChangeFromCash } = metrics;

  if (unresolvedExcessAmount <= eps) {
    if (resolution && resolution.excessAmount > eps) {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
    }
    return;
  }

  if (!resolution) {
    throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.REQUIRED);
  }

  if (Math.abs(resolution.excessAmount - unresolvedExcessAmount) > eps) {
    throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
  }

  for (const line of resolution.lines) {
    if (PHASE4_RESOLUTIONS.has(line.resolutionCode)) {
      if (!context.customerId) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
      }
      if (!('allocationPreviewId' in line) || !line.allocationPreviewId) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.REQUIRED);
      }
      if (context.tenantId) {
        const preview = await getAllocationPreview(context.tenantId, line.allocationPreviewId);
        if (!preview) {
          throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
        }
        if (preview.remainingUnallocatedAmount > eps) {
          throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.EXCESS_UNRESOLVED);
        }
        if (
          preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.CONFIRMED &&
          preview.previewStatus !== CUSTOMER_RECEIPT_PREVIEW_STATUSES.DRAFT
        ) {
          throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
        }
        if (Math.abs(preview.excessAmount - line.amount) > eps) {
          throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
        }
      }
      continue;
    }

    // VOID_OR_REFUND_EXCESS is rejected upstream by the resolution-code schema
    // (not a member of OverpaymentResolutionInput), so only RESTORE_STORED_VALUE
    // can reach this validator and needs blocking here.
    if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RESTORE_STORED_VALUE) {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
    }

    if (
      (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE ||
        line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET ||
        line.resolutionCode === OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT) &&
      !context.customerId
    ) {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
    }

    if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.REDUCE_PAYMENT) {
      throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.MISMATCH);
    }

    if (line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE) {
      if (!canReturnChangeFromCash) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.NOT_ALLOWED);
      }

      const paymentLeg = context.paymentLegs?.find((leg) => leg.legRef === line.legRef);
      if (!paymentLeg || paymentLeg.method !== PAYMENT_METHODS.CASH) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.RETURN_CHANGE_LEG_INVALID);
      }

      const planLegIndex =
        context.paymentLegs?.findIndex((leg) => leg.legRef === line.legRef) ?? -1;
      const planLeg = plan.realPaymentLegs.find((leg) => leg.legIndex === planLegIndex);
      if (!planLeg || !planLeg.supportsChangeReturn) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.RETURN_CHANGE_LEG_INVALID);
      }

      const legChangeCapacity = Math.max(
        0,
        (planLeg.tenderedAmount ?? planLeg.amount) - planLeg.amount
      );
      if (line.amount - legChangeCapacity > eps) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.RETURN_CHANGE_EXCEEDS_CAPACITY);
      }
      if (line.amount - cashChangeCapacity > eps) {
        throw new Error(OVERPAYMENT_RESOLUTION_ERROR_CODES.RETURN_CHANGE_EXCEEDS_CAPACITY);
      }
    }
  }
}
