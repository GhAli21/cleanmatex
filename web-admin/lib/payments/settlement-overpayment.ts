import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';

/** Authoritative overpayment metrics derived from a built settlement plan. */
export interface SettlementOverpaymentMetrics {
  /** Applied settlement total minus order total (leg amounts, not cash tendered). */
  excessAmount: number;
  /** Sum of (tendered − applied) on cash legs that support change return. */
  cashChangeCapacity: number;
  /** True when every cash leg in the plan supports change return. */
  canReturnChangeFromCash: boolean;
  /**
   * @deprecated Phase 6 — silent retained non-cash overpayment removed.
   * Always `false`; kept for response-shape compatibility.
   */
  hasAllowedRetainedOverpayment: boolean;
  /** Excess that must be explicitly resolved before submit (ADR-047). */
  unresolvedExcessAmount: number;
}

type OverpaymentPlanInput = {
  totalAmount: number;
  immediateSettlementAmount: number;
  realPaymentLegs: RealPaymentLeg[];
};

/**
 * Mirrors Payment Modal V4 excess logic so client and server agree on when
 * disposition is mandatory vs auto-handled via cash change only.
 */
export function computeSettlementOverpaymentMetrics(
  plan: OverpaymentPlanInput,
  epsilon = SETTLEMENT_MONEY_EPSILON
): SettlementOverpaymentMetrics {
  const excessAmount = Math.max(0, plan.immediateSettlementAmount - plan.totalAmount);

  const cashChangeCapacity = plan.realPaymentLegs.reduce((sum, leg) => {
    if (leg.paymentMethodCode !== PAYMENT_METHODS.CASH || !leg.supportsChangeReturn) {
      return sum;
    }
    const tendered = leg.tenderedAmount ?? leg.amount;
    return sum + Math.max(0, tendered - leg.amount);
  }, 0);

  const cashLegs = plan.realPaymentLegs.filter(
    (leg) => leg.paymentMethodCode === PAYMENT_METHODS.CASH
  );
  const canReturnChangeFromCash =
    cashLegs.length > 0 && cashLegs.every((leg) => leg.supportsChangeReturn);

  const changeResolvedAmount = canReturnChangeFromCash
    ? Math.min(excessAmount, cashChangeCapacity)
    : 0;
  const unresolvedExcessAmount = Math.max(0, excessAmount - changeResolvedAmount);

  return {
    excessAmount,
    cashChangeCapacity,
    canReturnChangeFromCash,
    hasAllowedRetainedOverpayment: false,
    unresolvedExcessAmount: unresolvedExcessAmount > epsilon ? unresolvedExcessAmount : 0,
  };
}
