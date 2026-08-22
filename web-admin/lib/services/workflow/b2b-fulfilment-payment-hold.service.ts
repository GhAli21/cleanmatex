import 'server-only';

/**
 * The intentionally narrow contract between workflow fulfilment and the B2B
 * domain. B2B owns invoice, credit, and account-policy decisions; workflow
 * only needs to know whether that domain has stopped the handover.
 */
export interface B2BFulfilmentPaymentHoldInput {
  paymentTypeCode: string | null;
}

/** Result returned to workflow without leaking B2B accounting implementation. */
export interface B2BFulfilmentPaymentHoldDecision {
  isBlocked: boolean;
}

/**
 * Resolves whether B2B payment policy stops fulfilment.
 *
 * Order creation is the current authority for B2B credit eligibility. Until
 * the dedicated B2B bounded context owns invoice/reservation revalidation,
 * this seam deliberately permits fulfilment. Replacing this implementation
 * later preserves the workflow gate contract for web, mobile, and partners.
 */
export function evaluateB2BFulfilmentPaymentHold(
  _input: B2BFulfilmentPaymentHoldInput,
): B2BFulfilmentPaymentHoldDecision {
  return { isBlocked: false };
}
