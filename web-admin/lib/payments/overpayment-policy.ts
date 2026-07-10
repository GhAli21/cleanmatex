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

/**
 * Whether a leg may retain amount above the order remaining (not cash change).
 * Requires explicit cashier pay-extra intent AND method capability.
 * Cash over-tender for change uses `supportsChangeReturn` separately — do not
 * treat change as retained overpayment.
 *
 * @param params.payExtraIntent - "Customer is paying extra" toggle
 * @param params.policy - Resolved method overpayment/change policy
 */
export function resolveSupportsRetainedOverpayment(params: {
  payExtraIntent: boolean;
  policy: Pick<
    PaymentOverpaymentPolicy,
    'isCash' | 'supportsChangeReturn' | 'supportsOverpayment'
  >;
}): boolean {
  if (!params.payExtraIntent) return false;
  return params.policy.isCash
    ? params.policy.supportsChangeReturn
    : params.policy.supportsOverpayment;
}

/**
 * Caps a Collect Payment amount entry using the same retained-overpay hard gate
 * as Payment Modal (QA-R4.5). Cash change uses a separate tendered field.
 */
export function capCollectPaymentAmount(params: {
  rawAmount: number;
  outstandingAmount: number;
  payExtraIntent: boolean;
  paymentMethodCode: string;
  supportsChangeReturn?: boolean | null;
  supportsOverpayment?: boolean | null;
  decimalPlaces?: number;
}): number {
  const {
    rawAmount,
    outstandingAmount,
    payExtraIntent,
    paymentMethodCode,
    supportsChangeReturn,
    supportsOverpayment,
    decimalPlaces = 3,
  } = params;
  const safeRaw = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;
  const policy = resolvePaymentOverpaymentPolicy({
    paymentMethodCode,
    supportsChangeReturn,
    supportsOverpayment,
  });
  if (
    resolveSupportsRetainedOverpayment({
      payExtraIntent,
      policy,
    })
  ) {
    return Number.parseFloat(safeRaw.toFixed(decimalPlaces));
  }
  const capped = Math.min(safeRaw, Math.max(0, outstandingAmount));
  return Number.parseFloat(capped.toFixed(decimalPlaces));
}

/**
 * Why an entered amount was (or would be) capped above remaining.
 * Used for inline cashier messaging — never tell them to enable pay-extra
 * when it is already ON.
 */
export type PaymentAmountCapReason =
  | 'cash_no_change'
  | 'pay_extra_off'
  | 'method_no_overpayment';

/**
 * Classifies a capped amount entry for UI copy.
 *
 * @returns Cap reason, or `null` when no cap messaging is needed.
 */
export function resolvePaymentAmountCapReason(params: {
  wasCapped: boolean;
  payExtraIntent: boolean;
  policy: PaymentOverpaymentPolicy;
}): PaymentAmountCapReason | null {
  if (!params.wasCapped) return null;
  if (params.policy.isCash && !params.policy.supportsChangeReturn) {
    return 'cash_no_change';
  }
  if (
    resolveSupportsRetainedOverpayment({
      payExtraIntent: params.payExtraIntent,
      policy: params.policy,
    })
  ) {
    return null;
  }
  return params.payExtraIntent ? 'method_no_overpayment' : 'pay_extra_off';
}

/**
 * Why adding a *new* payment leg must be refused (remaining already covered and
 * this method cannot retain overpayment). Existing legs are never auto-changed
 * — only new-leg creation is gated (cashier decision on legs already present).
 */
export type NewPaymentLegRejectReason = 'pay_extra_off' | 'method_no_overpayment';

/**
 * Returns a reject reason when a new leg for this method must not be created.
 * Methods stay selectable in the UI; the caller shows toast (and alert on repeat).
 *
 * @returns `null` when the new leg may be added.
 */
export function resolveNewPaymentLegRejection(params: {
  remainingBalance: number;
  payExtraIntent: boolean;
  policy: PaymentOverpaymentPolicy;
  moneyEpsilon: number;
}): NewPaymentLegRejectReason | null {
  if (params.remainingBalance > params.moneyEpsilon) return null;
  if (
    resolveSupportsRetainedOverpayment({
      payExtraIntent: params.payExtraIntent,
      policy: params.policy,
    })
  ) {
    return null;
  }
  return params.payExtraIntent ? 'method_no_overpayment' : 'pay_extra_off';
}

/**
 * @deprecated Prefer {@link resolveNewPaymentLegRejection} (prevent-at-add).
 * Kept for tests / transitional call sites — existing legs are no longer locked
 * by product rule (cashier decides what to do with legs already present).
 */
export function isPaymentLegDetailLocked(params: {
  legAmount: number | null | undefined;
  remainingBalance: number;
  supportsRetainedOverpayment: boolean;
  moneyEpsilon: number;
}): boolean {
  void params;
  return false;
}

/**
 * @deprecated See {@link isPaymentLegDetailLocked}.
 */
export function resolvePaymentLegDetailLockReason(params: {
  locked: boolean;
  payExtraIntent: boolean;
}): 'pay_extra_off' | 'method_no_overpayment' | null {
  if (!params.locked) return null;
  return params.payExtraIntent ? 'method_no_overpayment' : 'pay_extra_off';
}

