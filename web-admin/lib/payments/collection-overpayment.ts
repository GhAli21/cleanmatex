import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';
import { computeSettlementOverpaymentMetrics } from '@/lib/payments/settlement-overpayment';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';

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

export type CollectionOverpaymentMetrics = ReturnType<typeof computeSettlementOverpaymentMetrics>;

/**
 * Later-collection excess metrics — reuses checkout planner semantics with
 * order outstanding as the due total and collected leg sum as settlement total.
 */
export function computeCollectionOverpaymentMetrics(
  orderOutstanding: number,
  legs: CollectionLegInput[],
  epsilon = SETTLEMENT_MONEY_EPSILON
): CollectionOverpaymentMetrics {
  const totalCollected = legs.reduce((sum, leg) => sum + leg.amount, 0);
  const realPaymentLegs = legs.map(
    (leg) =>
      ({
        legIndex: leg.legIndex,
        paymentMethodCode: leg.paymentMethodCode,
        orgPaymentMethodId: leg.orgPaymentMethodId,
        amount: leg.amount,
        currencyCode: 'OMR',
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
