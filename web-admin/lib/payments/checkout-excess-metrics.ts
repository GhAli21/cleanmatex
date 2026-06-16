import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';

/** Leg input for checkout excess (modal or settlement plan). */
export interface CheckoutExcessLegInput {
  paymentMethodCode: string;
  amount: number;
  tenderedAmount?: number;
  supportsChangeReturn: boolean;
}

export interface CheckoutExcessMetricsInput {
  saleTotal: number;
  immediateSettlementAmount: number;
  legs: CheckoutExcessLegInput[];
  /** UI-only intent; when false, legacy change auto-resolution applies. */
  payExtraIntent?: boolean;
  /** Sum of RETURN_CASH_CHANGE resolution line amounts already chosen (intent ON). */
  explicitChangeResolved?: number;
  epsilon?: number;
}

/** Authoritative checkout overpayment metrics (client + server). */
export interface CheckoutExcessMetrics {
  appliedExcessAmount: number;
  tenderSurplusAmount: number;
  cashChangeCapacity: number;
  canReturnChangeFromCash: boolean;
  explicitChangeResolved: number;
  changeResolvedAmount: number;
  unresolvedExcessAmount: number;
}

function fromRealPaymentLegs(legs: RealPaymentLeg[]): CheckoutExcessLegInput[] {
  return legs.map((leg) => ({
    paymentMethodCode: leg.paymentMethodCode,
    amount: leg.amount,
    tenderedAmount: leg.tenderedAmount,
    supportsChangeReturn: leg.supportsChangeReturn,
  }));
}

/**
 * Computes pooled checkout excess for legacy (intent OFF) and pay-extra (intent ON) modes.
 */
export function computeCheckoutExcessMetrics(
  input: CheckoutExcessMetricsInput
): CheckoutExcessMetrics {
  const epsilon = input.epsilon ?? SETTLEMENT_MONEY_EPSILON;
  const payExtraIntent = input.payExtraIntent === true;
  const legs = input.legs;

  const appliedExcessAmount = Math.max(0, input.immediateSettlementAmount - input.saleTotal);

  const cashChangeCapacity = legs.reduce((sum, leg) => {
    if (leg.paymentMethodCode !== PAYMENT_METHODS.CASH || !leg.supportsChangeReturn) {
      return sum;
    }
    const tendered = leg.tenderedAmount ?? leg.amount;
    return sum + Math.max(0, tendered - leg.amount);
  }, 0);

  const cashLegs = legs.filter((leg) => leg.paymentMethodCode === PAYMENT_METHODS.CASH);
  const canReturnChangeFromCash =
    cashLegs.length > 0 && cashLegs.every((leg) => leg.supportsChangeReturn);

  const tenderSurplusAmount = payExtraIntent
    ? legs.reduce((sum, leg) => {
        if (leg.paymentMethodCode !== PAYMENT_METHODS.CASH) return sum;
        const tendered = leg.tenderedAmount ?? leg.amount;
        return sum + Math.max(0, tendered - leg.amount);
      }, 0)
    : 0;

  const explicitChangeResolved = payExtraIntent
    ? Math.max(0, input.explicitChangeResolved ?? 0)
    : 0;

  let changeResolvedAmount: number;
  let unresolvedExcessAmount: number;

  if (payExtraIntent) {
    changeResolvedAmount = explicitChangeResolved;
    unresolvedExcessAmount = Math.max(
      0,
      appliedExcessAmount + tenderSurplusAmount - changeResolvedAmount
    );
  } else {
    changeResolvedAmount = canReturnChangeFromCash
      ? Math.min(appliedExcessAmount, cashChangeCapacity)
      : 0;
    unresolvedExcessAmount = Math.max(0, appliedExcessAmount - changeResolvedAmount);
  }

  return {
    appliedExcessAmount,
    tenderSurplusAmount,
    cashChangeCapacity,
    canReturnChangeFromCash,
    explicitChangeResolved,
    changeResolvedAmount,
    unresolvedExcessAmount:
      unresolvedExcessAmount > epsilon ? unresolvedExcessAmount : 0,
  };
}

/** Adapter: settlement plan → checkout metrics (server default intent OFF). */
export function computeCheckoutExcessFromPlan(
  plan: {
    totalAmount: number;
    immediateSettlementAmount: number;
    realPaymentLegs: RealPaymentLeg[];
  },
  options: {
    payExtraIntent?: boolean;
    explicitChangeResolved?: number;
    epsilon?: number;
  } = {}
): CheckoutExcessMetrics {
  return computeCheckoutExcessMetrics({
    saleTotal: plan.totalAmount,
    immediateSettlementAmount: plan.immediateSettlementAmount,
    legs: fromRealPaymentLegs(plan.realPaymentLegs),
    payExtraIntent: options.payExtraIntent,
    explicitChangeResolved: options.explicitChangeResolved,
    epsilon: options.epsilon,
  });
}

/** @deprecated Use computeCheckoutExcessFromPlan — legacy shape for settlement-overpayment.ts */
export function toSettlementOverpaymentMetrics(metrics: CheckoutExcessMetrics) {
  return {
    excessAmount: metrics.appliedExcessAmount,
    cashChangeCapacity: metrics.cashChangeCapacity,
    canReturnChangeFromCash: metrics.canReturnChangeFromCash,
    hasAllowedRetainedOverpayment: false,
    unresolvedExcessAmount: metrics.unresolvedExcessAmount,
  };
}
