import { PAYMENT_METHODS } from '@/lib/constants/payment';

/**
 * Minimal payment-method fields needed to resolve overpayment behavior.
 */
export interface PaymentOverpaymentPolicySource {
  paymentMethodCode: string;
  supportsChangeReturn?: boolean | null;
  supportsOverpayment?: boolean | null;
  requiresCashDrawer?: boolean | null;
}

/**
 * Canonical overpayment/change policy used by checkout UI and settlement services.
 */
export interface PaymentOverpaymentPolicy {
  paymentMethodCode: string;
  isCash: boolean;
  supportsChangeReturn: boolean;
  supportsOverpayment: boolean;
  requiresCashDrawer: boolean;
}

/**
 * Resolves the effective method policy after payment-config services have already
 * applied branch overrides and tenant fallbacks.
 *
 * @param source Effective payment-method config from checkout or settlement lookup.
 * @returns Normalized policy flags for cash change and retained overpayment checks.
 */
export function resolvePaymentOverpaymentPolicy(
  source: PaymentOverpaymentPolicySource
): PaymentOverpaymentPolicy {
  const paymentMethodCode = source.paymentMethodCode.toUpperCase();
  const isCash = paymentMethodCode === PAYMENT_METHODS.CASH;

  return {
    paymentMethodCode,
    isCash,
    supportsChangeReturn: isCash && source.supportsChangeReturn === true,
    supportsOverpayment: source.supportsOverpayment === true,
    requiresCashDrawer: source.requiresCashDrawer === true,
  };
}

