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
 * When nothing remains to collect, the leg has no applied amount, and pay-extra
 * is OFF, method detail fields (card brand / last-4 / auth / check / gateway)
 * must not stay editable — same hard-gate spirit as a zero collect
 * (QA-R4.5 follow-up / Fully Settled screenshot).
 *
 * Unpaid orders (remaining > ε) keep details editable even at amount 0 so
 * cashiers can fill card/check metadata before the amount. Do **not** use this
 * to disable the amount editor — the engine already caps increases when
 * overpayment is not allowed.
 */
export function isPaymentLegDetailLocked(params: {
  legAmount: number | null | undefined;
  remainingBalance: number;
  payExtraIntent: boolean;
  moneyEpsilon: number;
}): boolean {
  const noAmount = (params.legAmount ?? 0) <= params.moneyEpsilon;
  const nothingLeft = params.remainingBalance <= params.moneyEpsilon;
  return noAmount && nothingLeft && !params.payExtraIntent;
}

