import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';
import {
  computeCheckoutExcessFromPlan,
  toSettlementOverpaymentMetrics,
} from '@/lib/payments/checkout-excess-metrics';

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

export type SettlementOverpaymentOptions = {
  payExtraIntent?: boolean;
  explicitChangeResolved?: number;
};

/**
 * Mirrors Payment Modal V4 excess logic so client and server agree on when
 * disposition is mandatory vs auto-handled via cash change only.
 */
export function computeSettlementOverpaymentMetrics(
  plan: OverpaymentPlanInput,
  epsilon = SETTLEMENT_MONEY_EPSILON,
  options: SettlementOverpaymentOptions = {}
): SettlementOverpaymentMetrics {
  const metrics = computeCheckoutExcessFromPlan(plan, {
    payExtraIntent: options.payExtraIntent,
    explicitChangeResolved: options.explicitChangeResolved,
    epsilon,
  });
  return toSettlementOverpaymentMetrics(metrics);
}
