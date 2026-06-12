import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';
import {
  sanitizeMoneyDraft as sanitizeDecimalDraft,
  parseMoneyDraft as parseDecimalDraft,
  applyKeypadInput,
  formatMoneyDraft,
} from '@/lib/money/money-draft';

export { sanitizeDecimalDraft, parseDecimalDraft, applyKeypadInput };

// PaymentKeypadKey moved to cmx-keypad-presets.ts (Phase 3a).
// Re-exported here for backward compatibility until payment-modal-v4.tsx is updated in Phase 5.
export type PaymentKeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'backspace'
  | 'clear'
  | '+10'
  | '+20'
  | '+50';

// Backward-compat wrapper — strips trailing zeros as the old implementation did.
// New code should import formatMoneyDraft from '@/lib/money/money-draft' directly.
export function formatDecimalDraft(value: number, decimalPlaces: number): string {
  return formatMoneyDraft(value, decimalPlaces, false).replace(/\.?0+$/, '');
}

export function syncDiscountFromPercent(
  subtotal: number,
  percent: number,
  decimalPlaces: number
): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  return Number.parseFloat(((subtotal * clampedPercent) / 100).toFixed(decimalPlaces));
}

export function syncDiscountPercentFromAmount(subtotal: number, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || subtotal <= 0) return 0;
  return Math.max(0, Math.min(100, (amount / subtotal) * 100));
}

export function deriveOutstandingPolicy(
  amountToCharge: number,
  saleTotal: number,
  preferred: OutstandingPolicy = 'PAY_ON_COLLECTION'
): OutstandingPolicy {
  if (amountToCharge >= saleTotal - 0.001) return 'NONE';
  return preferred;
}

export function deriveAmountAppliedToOrder(
  saleTotal: number,
  totalSettledNowAmount: number
): number {
  return Math.min(totalSettledNowAmount, saleTotal);
}

export const getAmountAppliedToOrder = deriveAmountAppliedToOrder;

export function deriveChangeReturnedAmount(
  cashTenderedAmount: number,
  cashAppliedAmount: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  const changeAmount = cashTenderedAmount - cashAppliedAmount;
  return canReturnChangeFromCash && changeAmount > epsilon ? changeAmount : 0;
}

export function getDisplayChangeAmount(
  changeAmount: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  return canReturnChangeFromCash && changeAmount > epsilon ? changeAmount : 0;
}

export function deriveUnresolvedOverpaymentAmount(
  excessAmount: number,
  cashChangeCapacity: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  if (excessAmount <= epsilon) return 0;
  const changeResolved = canReturnChangeFromCash
    ? Math.min(excessAmount, cashChangeCapacity)
    : 0;
  return Math.max(0, excessAmount - changeResolved);
}

export const getUnresolvedOverpaymentAmount = deriveUnresolvedOverpaymentAmount;

export function getNetCashRetainedAmount(
  cashLegAmount: number,
  changeAmount: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  if (!canReturnChangeFromCash || changeAmount <= epsilon) {
    return cashLegAmount;
  }
  return Math.max(0, cashLegAmount - changeAmount);
}

export function deriveCashTenderedAmount(
  rawTenderedAmount: number,
  appliedAmount: number,
  canReturnChangeFromCash: boolean,
  decimalPlaces: number
): number {
  const tenderedAmount = canReturnChangeFromCash
    ? Math.max(0, rawTenderedAmount)
    : appliedAmount;
  return Number.parseFloat(tenderedAmount.toFixed(decimalPlaces));
}

export function deriveLegAppliedAmount({
  rawAmount,
  paymentLegs,
  legIndex,
  saleTotal,
  giftCardAmount,
  decimalPlaces,
  walletBalance,
  supportsOverpayment = false,
}: {
  rawAmount: number;
  paymentLegs: Array<{ amount?: number }>;
  legIndex: number;
  saleTotal: number;
  giftCardAmount: number;
  decimalPlaces: number;
  walletBalance?: number;
  supportsOverpayment?: boolean;
}): number {
  if (supportsOverpayment && walletBalance == null) {
    return Number.parseFloat(Math.max(0, rawAmount).toFixed(decimalPlaces));
  }

  return capPaymentLegAmount(
    rawAmount,
    paymentLegs,
    legIndex,
    saleTotal,
    giftCardAmount,
    decimalPlaces,
    walletBalance
  );
}

/** Sum of payment-leg amounts, optionally excluding one leg index. */
export function getTotalLegSettled(
  paymentLegs: Array<{ amount?: number }>,
  excludeLegIndex?: number
): number {
  return paymentLegs.reduce(
    (sum, leg, legIdx) => sum + (legIdx === excludeLegIndex ? 0 : (leg.amount || 0)),
    0
  );
}

/**
 * Remaining order balance still available to allocate across payment legs,
 * after gift-card credits and other legs (optionally excluding one leg).
 */
export function getRemainingToAllocate(
  saleTotal: number,
  paymentLegs: Array<{ amount?: number }>,
  giftCardAmount: number,
  excludeLegIndex?: number,
  decimalPlaces = 3
): number {
  const otherLegsTotal = getTotalLegSettled(paymentLegs, excludeLegIndex);
  const remaining = saleTotal - giftCardAmount - otherLegsTotal;
  return Number.parseFloat(Math.max(0, remaining).toFixed(decimalPlaces));
}

/** Max amount a single leg may hold without exceeding sale total minus gift card and other legs. */
export function getLegOrderCap(
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  saleTotal: number,
  giftCardAmount = 0
): number {
  return getRemainingToAllocate(saleTotal, paymentLegs, giftCardAmount, idx);
}

/** Default amount when selecting or re-selecting a payment method leg. */
export function getSuggestedDefaultLegAmount(
  paymentLegs: Array<{ amount?: number }>,
  legIndex: number | undefined,
  saleTotal: number,
  giftCardAmount: number,
  decimalPlaces: number
): number {
  return getRemainingToAllocate(
    saleTotal,
    paymentLegs,
    giftCardAmount,
    legIndex,
    decimalPlaces
  );
}

export function getSuggestedStoredValueAmount(
  availableBalance: number,
  paymentLegs: Array<{ amount?: number }>,
  saleTotal: number,
  giftCardAmount: number,
  decimalPlaces: number,
  excludeLegIndex?: number
): number {
  const remaining = getRemainingToAllocate(
    saleTotal,
    paymentLegs,
    giftCardAmount,
    excludeLegIndex,
    decimalPlaces
  );
  return Number.parseFloat(
    Math.max(0, Math.min(availableBalance, remaining)).toFixed(decimalPlaces)
  );
}

export function capPaymentLegAmount(
  rawAmount: number,
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  saleTotal: number,
  giftCardAmount: number,
  decimalPlaces: number,
  walletBalance?: number
): number {
  let maxAmount = getLegOrderCap(paymentLegs, idx, saleTotal, giftCardAmount);
  if (walletBalance != null) {
    maxAmount = Math.min(maxAmount, walletBalance);
  }
  return Number.parseFloat(
    Math.max(0, Math.min(maxAmount, rawAmount)).toFixed(decimalPlaces)
  );
}

/**
 * Caps each leg when checkout totals or gift-card credits change so allocations
 * never exceed the canonical sale total.
 */
export function reconcilePaymentLegAmounts<T extends { amount?: number }>(
  paymentLegs: T[],
  saleTotal: number,
  giftCardAmount: number,
  decimalPlaces: number
): T[] {
  const next = paymentLegs.map((leg) => ({ ...leg }));
  for (let i = 0; i < next.length; i++) {
    const cap = getLegOrderCap(next, i, saleTotal, giftCardAmount);
    const current = next[i].amount ?? 0;
    if (current > cap + Math.pow(10, -(decimalPlaces + 1))) {
      next[i] = {
        ...next[i],
        amount: Number.parseFloat(cap.toFixed(decimalPlaces)),
      };
    }
  }
  return next;
}

/** Drops zero-amount placeholder legs while preserving at least one leg when provided. */
export function pruneZeroAmountLegs<T extends { amount?: number }>(
  paymentLegs: T[]
): T[] {
  const nonZero = paymentLegs.filter((leg) => (leg.amount ?? 0) > 0);
  return nonZero.length > 0 ? nonZero : paymentLegs;
}

export function getWalletLegMaxAmount(
  walletBalance: number,
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  saleTotal: number,
  decimalPlaces: number,
  giftCardAmount = 0
): number {
  return capPaymentLegAmount(
    walletBalance,
    paymentLegs,
    idx,
    saleTotal,
    giftCardAmount,
    decimalPlaces,
    walletBalance
  );
}

export function walletLegExceedsBalance(
  appliedAmount: number,
  availableBalance: number,
  epsilon = 0.001
): boolean {
  return appliedAmount - availableBalance > epsilon;
}

/** Mirrors server `validateSettlementPlan` reference checks for a single leg. */
export type PaymentLegReferenceFields = {
  method?: string;
  checkNumber?: string;
  bank_reference?: string;
  gateway_reference?: string;
  gateway_transaction_id?: string;
  auth_code?: string;
};

export function legHasRequiredPaymentReference(
  leg: PaymentLegReferenceFields,
  requiresReference: boolean
): boolean {
  if (!requiresReference) {
    return true;
  }
  if (leg.method === 'CARD' && leg.auth_code?.trim()) {
    return true;
  }
  return !!(
    leg.gateway_reference?.trim() ||
    leg.gateway_transaction_id?.trim() ||
    leg.bank_reference?.trim() ||
    leg.checkNumber?.trim()
  );
}

export type StoredValueCapContext = {
  walletBalance?: number;
  advanceBalance?: number;
  creditNoteBalance?: number;
  loyaltyBalance?: number;
};

/** Live balance cap for customer-credit payment legs, when applicable. */
export function getStoredValueCapForLeg(
  method: string,
  caps: StoredValueCapContext
): number | undefined {
  switch (method) {
    case 'WALLET':
      return caps.walletBalance;
    case 'ADVANCE':
      return caps.advanceBalance;
    case 'CREDIT_NOTE':
      return caps.creditNoteBalance;
    case 'LOYALTY_POINTS':
      return caps.loyaltyBalance;
    default:
      return undefined;
  }
}

/** All cash legs must allow change for aggregate change-return UX to match server rules. */
export function canReturnChangeFromAllCashLegs(
  cashLegs: Array<{ supportsChangeReturn: boolean }>
): boolean {
  return cashLegs.length > 0 && cashLegs.every((leg) => leg.supportsChangeReturn);
}

/** True when a leg amount was capped because allocation cannot exceed remaining due. */
export function wasPaymentLegAmountCapped(
  rawAmount: number,
  cappedAmount: number,
  epsilon = 0.001
): boolean {
  return rawAmount - cappedAmount > epsilon;
}

/**
 * Scope for a cashier-local cash drawer preference.
 *
 * The branch and user are part of the key so a cashier moving branches or
 * sharing a browser profile never inherits another checkout context.
 */
export type PreferredCashDrawerStorageScope = {
  tenantOrgId?: string | null;
  branchId?: string | null;
  userId?: string | null;
};

/**
 * Minimal drawer/session shape needed to resolve a stable drawer preference
 * to the current open session.
 */
export type PreferredCashDrawerSessionChoice = {
  drawer: {
    id: string;
  };
  session: {
    id: string;
  };
};

/**
 * Builds the browser-local key for the preferred cash drawer id.
 *
 * @param root0 Preference scope.
 * @param root0.tenantOrgId Tenant boundary for the saved drawer preference.
 * @param root0.branchId Branch boundary for the saved drawer preference.
 * @param root0.userId Cashier boundary for the saved drawer preference.
 * @returns Scoped storage key, or null when the preference cannot be safely scoped.
 */
export function getPreferredCashDrawerStorageKey({
  tenantOrgId,
  branchId,
  userId,
}: PreferredCashDrawerStorageScope): string | null {
  const tenant = tenantOrgId?.trim();
  const branch = branchId?.trim();
  const user = userId?.trim();

  if (!tenant || !branch || !user) {
    return null;
  }

  return `cmx:payment:v4:preferred-cash-drawer:${encodeURIComponent(tenant)}:${encodeURIComponent(branch)}:${encodeURIComponent(user)}`;
}

/**
 * Resolves a saved drawer id to the current open session id.
 *
 * We intentionally persist drawer id instead of session id because sessions
 * close and reopen; this keeps reuse convenient without bypassing live drawer
 * validation.
 *
 * @param choices Open drawer/session choices from the latest API response.
 * @param preferredCashDrawerId Saved stable cash drawer id.
 * @returns Current open session id for that drawer, or null when unavailable.
 */
export function resolvePreferredCashDrawerSessionId(
  choices: PreferredCashDrawerSessionChoice[],
  preferredCashDrawerId: string | null | undefined
): string | null {
  const preferred = preferredCashDrawerId?.trim();

  if (!preferred) {
    return null;
  }

  return choices.find(({ drawer }) => drawer.id === preferred)?.session.id ?? null;
}

// ─── BVM Phase 6 Sub-item 4 helpers ─────────────────────────────────────────

// Phase 6 Sub-item 6 hoisted these into `lib/utils/check-date` so the same
// rule fires inside the server-side Zod schema (paymentLegSchema). The
// re-export keeps the existing modal imports and tests stable without
// duplicating the logic.
export { todayYyyyMmDd, validateCheckDueDate } from '@/lib/utils/check-date';

/**
 * Build a state envelope to round-trip through the HYPERPAY (or PayTabs /
 * Stripe) gateway redirect flow.
 *
 * Why:
 * The gateway redirects the operator's browser away and back. Without an
 * envelope, every in-flight form field (selected legs, discounts, customer
 * id) would be lost. The envelope is opaque to the gateway — only the
 * client posts it to sessionStorage before redirect and reads it back on
 * return. The payload is JSON-stringified and the result is safe to embed
 * in a sessionStorage value or URL query parameter.
 *
 * @param state Arbitrary serializable object. Callers should keep it small
 *              (sessionStorage and URL limits both apply).
 * @returns Compact JSON string. Returns `''` if `state` cannot be
 *          serialised (e.g. circular references) so the caller can fall
 *          back to a fresh form on return rather than throwing mid-redirect.
 */
export function buildGatewayReturnState(state: Record<string, unknown>): string {
  try {
    return JSON.stringify(state);
  } catch {
    return '';
  }
}

/**
 * Parse the envelope built by {@link buildGatewayReturnState}.
 *
 * Returns `null` for empty / malformed input so the caller can safely
 * default-init the form. Rejecting the entire envelope on a parse error
 * is the right call here — partial state is worse than a clean reload
 * because the operator can re-enter values, but cannot diagnose half a
 * form populated with stale gateway-flow data.
 */
export function parseGatewayReturnState(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
