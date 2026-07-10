import type { OutstandingPolicy, PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import {
  sanitizeMoneyDraft as sanitizeDecimalDraft,
  parseMoneyDraft as parseDecimalDraft,
  applyKeypadInput,
  formatMoneyDraft,
} from '@/lib/money/money-draft';

export { sanitizeDecimalDraft, parseDecimalDraft, applyKeypadInput };

// PaymentKeypadKey moved to cmx-keypad-presets.ts (Phase 3a).
// Re-exported here for backward compatibility until payment-modal-v4.tsx is updated in Phase 5.
/**
 *
 */
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
/**
 *
 * @param value
 * @param decimalPlaces
 */
export function formatDecimalDraft(value: number, decimalPlaces: number): string {
  return formatMoneyDraft(value, decimalPlaces, false).replace(/\.?0+$/, '');
}

/**
 *
 * @param subtotal
 * @param percent
 * @param decimalPlaces
 */
export function syncDiscountFromPercent(
  subtotal: number,
  percent: number,
  decimalPlaces: number
): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  return Number.parseFloat(((subtotal * clampedPercent) / 100).toFixed(decimalPlaces));
}

/**
 *
 * @param subtotal
 * @param amount
 */
export function syncDiscountPercentFromAmount(subtotal: number, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || subtotal <= 0) return 0;
  return Math.max(0, Math.min(100, (amount / subtotal) * 100));
}

/**
 *
 * @param amountToCharge
 * @param saleTotal
 * @param preferred
 */
export function deriveOutstandingPolicy(
  amountToCharge: number,
  saleTotal: number,
  preferred: OutstandingPolicy = 'PAY_ON_COLLECTION'
): OutstandingPolicy {
  if (amountToCharge >= saleTotal - 0.001) return 'NONE';
  return preferred;
}

/**
 *
 * @param saleTotal
 * @param totalSettledNowAmount
 */
export function deriveAmountAppliedToOrder(
  saleTotal: number,
  totalSettledNowAmount: number
): number {
  return Math.min(totalSettledNowAmount, saleTotal);
}

export const getAmountAppliedToOrder = deriveAmountAppliedToOrder;

/**
 *
 * @param cashTenderedAmount
 * @param cashAppliedAmount
 * @param canReturnChangeFromCash
 * @param epsilon
 */
export function deriveChangeReturnedAmount(
  cashTenderedAmount: number,
  cashAppliedAmount: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  const changeAmount = cashTenderedAmount - cashAppliedAmount;
  return canReturnChangeFromCash && changeAmount > epsilon ? changeAmount : 0;
}

/**
 *
 * @param changeAmount
 * @param canReturnChangeFromCash
 * @param epsilon
 */
export function getDisplayChangeAmount(
  changeAmount: number,
  canReturnChangeFromCash: boolean,
  epsilon = 0.001
): number {
  return canReturnChangeFromCash && changeAmount > epsilon ? changeAmount : 0;
}

/**
 *
 * @param excessAmount
 * @param cashChangeCapacity
 * @param canReturnChangeFromCash
 * @param epsilon
 */
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

/**
 *
 * @param cashLegAmount
 * @param changeAmount
 * @param canReturnChangeFromCash
 * @param epsilon
 */
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

/**
 *
 * @param rawTenderedAmount
 * @param appliedAmount
 * @param canReturnChangeFromCash
 * @param decimalPlaces
 */
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

/**
 *
 * @param root0
 * @param root0.rawAmount
 * @param root0.paymentLegs
 * @param root0.legIndex
 * @param root0.saleTotal
 * @param root0.giftCardAmount
 * @param root0.decimalPlaces
 * @param root0.walletBalance
 * @param root0.supportsOverpayment
 */
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

/**
 * Sum of payment-leg amounts, optionally excluding one leg index.
 * @param paymentLegs
 * @param excludeLegIndex
 */
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
 * @param saleTotal
 * @param paymentLegs
 * @param giftCardAmount
 * @param excludeLegIndex
 * @param decimalPlaces
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

/**
 * Max amount a single leg may hold without exceeding sale total minus gift card and other legs.
 * @param paymentLegs
 * @param idx
 * @param saleTotal
 * @param giftCardAmount
 */
export function getLegOrderCap(
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  saleTotal: number,
  giftCardAmount = 0
): number {
  return getRemainingToAllocate(saleTotal, paymentLegs, giftCardAmount, idx);
}

/**
 * Default amount when selecting or re-selecting a payment method leg.
 * @param paymentLegs
 * @param legIndex
 * @param saleTotal
 * @param giftCardAmount
 * @param decimalPlaces
 */
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

/**
 *
 * @param availableBalance
 * @param paymentLegs
 * @param saleTotal
 * @param giftCardAmount
 * @param decimalPlaces
 * @param excludeLegIndex
 */
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

/**
 *
 * @param rawAmount
 * @param paymentLegs
 * @param idx
 * @param saleTotal
 * @param giftCardAmount
 * @param decimalPlaces
 * @param walletBalance
 */
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
 * @param paymentLegs
 * @param saleTotal
 * @param giftCardAmount
 * @param decimalPlaces
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

/**
 * Drops zero-amount placeholder legs while preserving at least one leg when provided.
 * @param paymentLegs
 */
export function pruneZeroAmountLegs<T extends { amount?: number }>(
  paymentLegs: T[]
): T[] {
  const nonZero = paymentLegs.filter((leg) => (leg.amount ?? 0) > 0);
  return nonZero.length > 0 ? nonZero : paymentLegs;
}

/**
 *
 * @param walletBalance
 * @param paymentLegs
 * @param idx
 * @param saleTotal
 * @param decimalPlaces
 * @param giftCardAmount
 */
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

/**
 *
 * @param appliedAmount
 * @param availableBalance
 * @param epsilon
 */
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

/**
 *
 * @param leg
 * @param requiresReference
 */
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

/**
 *
 */
export type StoredValueCapContext = {
  walletBalance?: number;
  advanceBalance?: number;
  creditNoteBalance?: number;
  loyaltyBalance?: number;
};

/**
 * Live balance cap for customer-credit payment legs, when applicable.
 * @param method
 * @param caps
 */
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

/**
 * All cash legs must allow change for aggregate change-return UX to match server rules.
 * @param cashLegs
 */
export function canReturnChangeFromAllCashLegs(
  cashLegs: Array<{ supportsChangeReturn: boolean }>
): boolean {
  return cashLegs.length > 0 && cashLegs.every((leg) => leg.supportsChangeReturn);
}

/**
 * True when a leg amount was capped because allocation cannot exceed remaining due.
 * @param rawAmount
 * @param cappedAmount
 * @param epsilon
 */
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
 * @param raw
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

/**
 * Overpayment/change policy a {@link quickTender} caller resolves for the target leg
 * (from `resolvePaymentOverpaymentPolicy`). Structural so callers pass the already-
 * resolved policy rather than re-deriving it inside the pure function.
 */
export interface QuickTenderPolicy {
  isCash: boolean;
  supportsChangeReturn: boolean;
  supportsOverpayment: boolean;
}

/**
 * Inputs for the pure {@link quickTender} helper.
 */
export interface QuickTenderInput {
  /** `'exact'` settles the remaining cap; `'change'` sets a cash change-to-return (#2). */
  kind: 'exact' | 'change';
  /** Desired change-to-return; required (and only honored) when `kind === 'change'`. */
  changeValue?: number;
  /** The target leg. */
  leg: PaymentLeg;
  /** All current legs (for the remaining-to-allocate cap). */
  legs: PaymentLeg[];
  /** Index of the target leg within `legs`. */
  legIndex: number;
  saleTotal: number;
  giftCardSettlementAmount: number;
  decimalPlaces: number;
  /** Stored-value cap for the leg (`getLegStoredValueCap(leg)`), when applicable. */
  storedValueCap?: number;
  /** Resolved overpayment/change policy for the target leg. */
  policy: QuickTenderPolicy;
}

/**
 * Result of {@link quickTender}: the amount to apply and (for cash legs) the tender.
 */
export interface QuickTenderResult {
  appliedAmount: number;
  cashTendered?: number;
}

/**
 * Pure quick-tender resolver — input assistance only, never a gate bypass.
 *
 * The applied amount is ALWAYS routed through the same leg-capping gate the keypad
 * uses ({@link deriveLegAppliedAmount} in capping mode), so it can never exceed the
 * remaining-to-allocate cap (nor the stored-value cap) and therefore never silently
 * bypasses overpayment / `payExtra` routing. For cash legs the change-entry variant
 * (#2) only adds the requested change-to-return on top of the applied amount as extra
 * tender (and only when the method supports returning change); applied is untouched.
 *
 * Lives in the utils module (not the hook) so it is jest-testable without pulling in
 * the hook's `cmxMessage` import chain. The `usePaymentLegs` hook re-exports it.
 *
 * @param input - {@link QuickTenderInput}.
 * @returns {@link QuickTenderResult} — `{ appliedAmount, cashTendered? }`.
 */
/**
 * A single quick-tender chip (UX finding 1.2 — the cash fast lane).
 *
 * `exact` settles the remaining cap (valid for every method); `tender` chips are
 * cash-only shortcuts for "the customer handed a note": the value is applied via
 * the SAME capped path as the keypad/amount field, so applied never exceeds the
 * remaining-to-allocate cap — the surplus becomes tendered cash/change.
 */
export interface QuickTenderChipModel {
  /** Stable id for keys/testids, e.g. `exact`, `next-5`, `note-50`. */
  id: string;
  kind: 'exact' | 'tender';
  /** Cash handed over for `tender` chips; absent for `exact`. */
  tenderAmount?: number;
}

/**
 * Common cash-note ladders by currency (program decision: currency-derived
 * defaults, no tenant setting). High-unit 3-dp GCC currencies use smaller note
 * values; everything else uses the generic 5→100 ladder.
 *
 * @param currencyCode ISO currency code (e.g. `OMR`, `SAR`).
 * @returns Ascending denomination values for quick-tender chips.
 */
export function deriveQuickTenderDenominations(currencyCode: string): number[] {
  switch (currencyCode?.toUpperCase?.()) {
    case 'OMR':
    case 'BHD':
    case 'KWD':
      return [1, 5, 10, 20, 50];
    case 'SAR':
    case 'AED':
    case 'QAR':
      return [10, 50, 100, 200, 500];
    default:
      return [5, 10, 20, 50, 100];
  }
}

/**
 * Inputs for {@link deriveQuickTenderChips}.
 */
export interface DeriveQuickTenderChipsInput {
  /** Remaining-to-allocate cap for the active leg (its own amount excluded). */
  remaining: number;
  currencyCode: string;
  decimalPlaces: number;
  /** Whether the active leg is cash (tender chips are cash-only). */
  isCash: boolean;
  epsilon?: number;
}

/**
 * Pure chip-row deriver for the quick-tender fast lane: `[Exact] [Next d1]
 * [Next d2] [note] [note]` (cash) or `[Exact]` (non-cash). Values are decimal-
 * rounded, deduped, and strictly greater than the exact amount so every chip is
 * a meaningful one-tap action. Returns `[]` when nothing remains to settle.
 *
 * @param input - {@link DeriveQuickTenderChipsInput}.
 * @returns Chips ordered `exact` first, then ascending tender values (max 5).
 */
export function deriveQuickTenderChips({
  remaining,
  currencyCode,
  decimalPlaces,
  isCash,
  epsilon = 0.001,
}: DeriveQuickTenderChipsInput): QuickTenderChipModel[] {
  if (!(remaining > epsilon)) return [];

  const chips: QuickTenderChipModel[] = [{ id: 'exact', kind: 'exact' }];
  if (!isCash) return chips;

  const round = (value: number) => Number(value.toFixed(decimalPlaces));
  const exactValue = round(remaining);
  const denominations = deriveQuickTenderDenominations(currencyCode);
  const seen = new Set<number>([exactValue]);
  const tenderValues: number[] = [];

  const pushTender = (value: number) => {
    const rounded = round(value);
    if (rounded - exactValue <= epsilon) return; // no-op vs Exact
    if (seen.has(rounded)) return;
    seen.add(rounded);
    tenderValues.push(rounded);
  };

  // Round-up chips for the two smallest denominations ("Next 5", "Next 10").
  for (const denomination of denominations.slice(0, 2)) {
    pushTender(Math.ceil((remaining - epsilon) / denomination) * denomination);
  }
  // Flat-note chips for the two largest denominations (e.g. 50, 100).
  for (const denomination of denominations.slice(-2)) {
    pushTender(denomination);
  }

  tenderValues.sort((left, right) => left - right);
  for (const value of tenderValues.slice(0, 4)) {
    chips.push({ id: `tender-${value}`, kind: 'tender', tenderAmount: value });
  }
  return chips;
}

export function quickTender({
  kind,
  changeValue,
  legs,
  legIndex,
  saleTotal,
  giftCardSettlementAmount,
  decimalPlaces,
  storedValueCap,
  policy,
}: QuickTenderInput): QuickTenderResult {
  // Remaining order balance this leg may settle, excluding its own current amount.
  const remaining = getRemainingToAllocate(
    saleTotal,
    legs,
    giftCardSettlementAmount,
    legIndex,
    decimalPlaces
  );

  // Gate-preserving: capped to remaining (and the stored-value cap, if any). Both
  // `exact` and `change` settle the leg at the remaining cap — change-entry never
  // raises the applied amount, only the cash tendered.
  const appliedAmount = deriveLegAppliedAmount({
    rawAmount: remaining,
    paymentLegs: legs,
    legIndex,
    saleTotal,
    giftCardAmount: giftCardSettlementAmount,
    decimalPlaces,
    walletBalance: storedValueCap,
    supportsOverpayment: false,
  });

  if (!policy.isCash) {
    // Non-cash "exact" (and any non-cash kind) == the remaining cap; no tender/change.
    return { appliedAmount };
  }

  // Cash: direct-change-entry (#2) adds the requested change on top of the applied
  // amount as extra tender, but only when the method can return change; otherwise it
  // clamps to exact (tendered == applied, no change).
  const wantsChange =
    kind === 'change' && policy.supportsChangeReturn && (changeValue ?? 0) > 0;
  const rawTendered = wantsChange ? appliedAmount + (changeValue ?? 0) : appliedAmount;
  const cashTendered = deriveCashTenderedAmount(
    rawTendered,
    appliedAmount,
    policy.supportsChangeReturn,
    decimalPlaces
  );
  return { appliedAmount, cashTendered };
}

// ---------------------------------------------------------------------------
// Phase 4 — Simple / Full mode (single engine, two faces)
// ---------------------------------------------------------------------------

/**
 * The two faces of Payment Modal v4 (ADR: single engine, two modes). The modal
 * opens in Simple and auto-escalates to Full when `computeNeedsAdvanced` trips.
 */
export const PAYMENT_MODAL_MODE = {
  SIMPLE: 'simple',
  FULL: 'full',
} as const;

/**
 * Union of payment-modal mode values.
 */
export type PaymentModalMode =
  (typeof PAYMENT_MODAL_MODE)[keyof typeof PAYMENT_MODAL_MODE];

/**
 * Method codes that are operable inside Simple mode without the Full
 * workbench: cash plus card/gateway tenders. Everything else (check, bank
 * transfer, credit notes, wallet, deferred/invoice policies) needs detail
 * fields or routing that only the Full workspace renders. Codes mirror the DB
 * (`PAYMENT_METHODS`) — never reformat them.
 */
const SIMPLE_MODE_METHOD_CODES: readonly string[] = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.MOBILE_PAYMENT,
  PAYMENT_METHODS.PAYMENT_GATEWAY,
  PAYMENT_METHODS.HYPERPAY,
  PAYMENT_METHODS.PAYTABS,
  PAYMENT_METHODS.STRIPE,
];

/**
 * Maximum method chips the Simple face shows; the rest sit behind the
 * "More options" chip, which switches to Full mode.
 */
export const SIMPLE_MODE_METHOD_CHIP_LIMIT = 3;

/**
 * Structural pick of `CheckoutSettlementOption` used by
 * {@link deriveSimpleModeMethodOptions}, so the pure helper stays decoupled
 * from the catalog hook's client import chain (jest-safe).
 */
export interface SimpleModeMethodOptionLike {
  payment_method_code: string;
  /** Gateway identity when the catalog row is a gateway tender (e.g. STRIPE). */
  gateway_code?: string | null;
  /** Options that demand a reference (auth code, bank ref) need Full mode. */
  requires_reference?: boolean | null;
}

/** Minimal leg shape for Simple-face active-leg retargeting (no money fields). */
export interface SimpleFaceLegLike {
  method: string;
  gateway_code?: string | null;
}

function settlementOptionKey(
  paymentMethodCode: string,
  gatewayCode?: string | null
): string {
  return `${paymentMethodCode}::${gatewayCode ?? ''}`;
}

/**
 * Composite catalog/leg identity key (`method::gateway`). Use for option maps,
 * chip matching, and Simple-face retarget — never match on method code alone
 * when gateways can share a method family.
 */
export function toSettlementOptionKey(
  paymentMethodCode: string,
  gatewayCode?: string | null
): string {
  return settlementOptionKey(paymentMethodCode, gatewayCode);
}

/**
 * True when the leg matches one of the Simple face method chips (same method +
 * gateway identity). Legs behind "More options" (chip cap / Advanced-only) are
 * not Simple-editable even if their method code is in {@link SIMPLE_MODE_METHOD_CODES}.
 */
export function isLegOnSimpleFace(
  leg: SimpleFaceLegLike,
  simpleOptions: SimpleModeMethodOptionLike[]
): boolean {
  const key = settlementOptionKey(leg.method, leg.gateway_code);
  return simpleOptions.some(
    (option) =>
      settlementOptionKey(option.payment_method_code, option.gateway_code) === key
  );
}

/**
 * When switching Advanced → Simple, keep engine state but retarget the active
 * leg to a chip-visible tender so the Simple amount/detail editor does not keep
 * showing an Advanced-only (or off-chip) leg. Never mutates amounts — index only.
 *
 * Preference: keep `currentIndex` if already chip-visible; else first chip that
 * already has a leg (chip order); else leave `currentIndex` unchanged (Simple UI
 * hides the editor until the cashier picks a chip).
 */
export function resolveSimpleFaceActiveLegIndex(params: {
  paymentLegs: SimpleFaceLegLike[];
  simpleOptions: SimpleModeMethodOptionLike[];
  currentIndex: number;
}): number {
  const { paymentLegs, simpleOptions, currentIndex } = params;
  if (paymentLegs.length === 0) return currentIndex;

  const current = paymentLegs[currentIndex];
  if (current && isLegOnSimpleFace(current, simpleOptions)) {
    return currentIndex;
  }

  for (const option of simpleOptions) {
    const key = settlementOptionKey(option.payment_method_code, option.gateway_code);
    const idx = paymentLegs.findIndex(
      (leg) => settlementOptionKey(leg.method, leg.gateway_code) === key
    );
    if (idx >= 0) return idx;
  }

  return currentIndex;
}

/**
 * Pure Simple-mode method-chip deriver: keeps only tenders a cashier can
 * complete on the Simple face (cash + card/gateway, no reference-detail
 * requirements), orders cash first (catalog order otherwise, stable), and caps
 * the row at {@link SIMPLE_MODE_METHOD_CHIP_LIMIT}. Selecting anything outside
 * this set goes through "More options" → Full mode; a leg that later demands
 * detail (terminal, references) either renders its compact field in Simple or
 * blocks submit, which escalates to Full.
 *
 * @param options Catalog settlement options (already tenant/branch filtered).
 * @returns Chip options for the Simple face, cash first, at most the cap.
 */
export function deriveSimpleModeMethodOptions<T extends SimpleModeMethodOptionLike>(
  options: T[]
): T[] {
  const safe = options.filter(
    (option) =>
      SIMPLE_MODE_METHOD_CODES.includes(option.payment_method_code) &&
      !option.requires_reference
  );
  const cashFirst = [
    ...safe.filter((option) => option.payment_method_code === PAYMENT_METHODS.CASH),
    ...safe.filter((option) => option.payment_method_code !== PAYMENT_METHODS.CASH),
  ];
  return cashFirst.slice(0, SIMPLE_MODE_METHOD_CHIP_LIMIT);
}
