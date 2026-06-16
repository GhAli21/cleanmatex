import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { OverpaymentResolutionInput, PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { RealPaymentLeg } from '@/lib/types/settlement-plan';

const TOLERANCE = 0.001;

/**
 * Resolves explicit cash change for voucher lines when overpayment resolution
 * is present (pay-extra intent). Returns undefined to let voucher-line auto-derive (legacy).
 */
export function resolveVoucherCashChangeReturned(
  leg: RealPaymentLeg,
  paymentLegs: PaymentLeg[] | undefined,
  resolution: OverpaymentResolutionInput | undefined
): number | undefined {
  if (leg.paymentMethodCode !== PAYMENT_METHODS.CASH) {
    return undefined;
  }

  const tendered = leg.tenderedAmount ?? leg.amount;
  const autoChange = Math.max(0, tendered - leg.amount);
  if (autoChange <= TOLERANCE) {
    return undefined;
  }

  if (!resolution || resolution.lines.length === 0) {
    return undefined;
  }

  const paymentLeg = paymentLegs?.[leg.legIndex];
  const legRef = paymentLeg?.legRef;

  const changeFromResolution = resolution.lines
    .filter((line) => line.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE)
    .filter((line) => !legRef || ('legRef' in line && line.legRef === legRef))
    .reduce((sum, line) => sum + line.amount, 0);

  if (changeFromResolution > TOLERANCE) {
    return Math.min(changeFromResolution, autoChange);
  }

  const hasNonChangeDisposition = resolution.lines.some(
    (line) =>
      line.resolutionCode !== OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE &&
      line.resolutionCode !== OVERPAYMENT_RESOLUTIONS.REDUCE_PAYMENT
  );

  if (hasNonChangeDisposition) {
    return 0;
  }

  return undefined;
}
