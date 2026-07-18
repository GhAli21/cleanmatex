import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import {
  computeCheckoutExcessMetrics,
  type CheckoutExcessLegInput,
} from '@/lib/payments/checkout-excess-metrics';
import { computeSettlementOverpaymentMetrics } from '@/lib/payments/settlement-overpayment';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';

/**
 *
 */
export interface CollectionLegInput {
  paymentMethodCode: string;
  amount: number;
  cashTendered?: number;
  supportsChangeReturn: boolean;
  supportsOverpayment: boolean;
  orgPaymentMethodId: string;
  legIndex: number;
  gatewayCode?: string | null;
  requiresCashDrawer: boolean;
  reference?: string;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: string;
}

/**
 *
 */
export type CollectionOverpaymentMetrics = ReturnType<typeof computeSettlementOverpaymentMetrics>;

/**
 *
 */
export interface CollectionOverpaymentOptions {
  payExtraIntent?: boolean;
  explicitChangeResolved?: number;
  epsilon?: number;
  /** Order currency, threaded onto the synthesized legs (B15 — no literal defaults). */
  currencyCode?: string;
}

/**
 * Later-collection excess metrics — reuses checkout planner semantics with
 * order outstanding as the due total and collected leg sum as settlement total.
 * @param orderOutstanding
 * @param legs
 * @param options
 */
export function computeCollectionOverpaymentMetrics(
  orderOutstanding: number,
  legs: CollectionLegInput[],
  options: CollectionOverpaymentOptions = {}
): CollectionOverpaymentMetrics {
  const epsilon = options.epsilon ?? SETTLEMENT_MONEY_EPSILON;
  const totalCollected = legs.reduce((sum, leg) => sum + leg.amount, 0);

  if (options.payExtraIntent) {
    const checkoutLegs: CheckoutExcessLegInput[] = legs.map((leg) => ({
      paymentMethodCode: leg.paymentMethodCode,
      amount: leg.amount,
      tenderedAmount: leg.cashTendered,
      supportsChangeReturn: leg.supportsChangeReturn,
    }));
    const checkout = computeCheckoutExcessMetrics({
      saleTotal: orderOutstanding,
      immediateSettlementAmount: totalCollected,
      legs: checkoutLegs,
      payExtraIntent: true,
      explicitChangeResolved: options.explicitChangeResolved ?? 0,
      epsilon,
    });
    return {
      excessAmount: checkout.appliedExcessAmount,
      cashChangeCapacity: checkout.cashChangeCapacity,
      canReturnChangeFromCash: checkout.canReturnChangeFromCash,
      hasAllowedRetainedOverpayment: legs.some(
        (leg) =>
          leg.supportsOverpayment ||
          (leg.paymentMethodCode === PAYMENT_METHODS.CASH && leg.supportsChangeReturn)
      ),
      unresolvedExcessAmount: checkout.unresolvedExcessAmount,
    };
  }

  const realPaymentLegs = legs.map(
    (leg) =>
      ({
        legIndex: leg.legIndex,
        paymentMethodCode: leg.paymentMethodCode,
        orgPaymentMethodId: leg.orgPaymentMethodId,
        amount: leg.amount,
        // Not consumed by the metrics math — threaded through when the caller
        // has it, blank otherwise (never a literal currency default, B15).
        currencyCode: options.currencyCode ?? '',
        tenderedAmount: leg.cashTendered,
        supportsChangeReturn: leg.supportsChangeReturn,
        supportsOverpayment: leg.supportsOverpayment,
        requiresReference: false,
        requiresCashDrawer: false,
        requiresTerminal: false,
        defaultCreationStatus: 'COMPLETED',
        allowStatusOverride: false,
        resolvedPaymentStatus: 'COMPLETED',
      }) as RealPaymentLeg
  );

  return computeSettlementOverpaymentMetrics(
    {
      totalAmount: orderOutstanding,
      immediateSettlementAmount: totalCollected,
      realPaymentLegs,
    },
    epsilon
  );
}

/**
 *
 * @param appliedBeforeLeg
 * @param legAmount
 * @param orderOutstanding
 * @param methodCode
 * @param supportsOverpayment
 */
export function collectionLegIntroducesUnresolvedExcess(
  appliedBeforeLeg: number,
  legAmount: number,
  orderOutstanding: number,
  methodCode: string,
  supportsOverpayment: boolean
): boolean {
  const excessBeforeLeg = Math.max(0, appliedBeforeLeg - orderOutstanding);
  const excessAfterLeg = Math.max(0, appliedBeforeLeg + legAmount - orderOutstanding);
  const excessIntroduced = excessAfterLeg - excessBeforeLeg;
  if (excessIntroduced <= SETTLEMENT_MONEY_EPSILON) return false;
  return methodCode === PAYMENT_METHODS.CASH || !supportsOverpayment;
}
