import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';

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

export function sanitizeDecimalDraft(raw: string, decimalPlaces: number): string {
  let value = raw.replace(/[^\d.]/g, '');
  if (value.startsWith('.')) value = `0${value}`;
  const decimalIndex = value.indexOf('.');
  if (decimalIndex !== -1) {
    value =
      value.slice(0, decimalIndex + 1) +
      value.slice(decimalIndex + 1).replace(/\./g, '');
    const fraction = value.slice(decimalIndex + 1);
    if (fraction.length > decimalPlaces) {
      value = value.slice(0, decimalIndex + 1 + decimalPlaces);
    }
  }
  return value;
}

export function parseDecimalDraft(value: string): number {
  if (!value || value === '.') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDecimalDraft(value: number, decimalPlaces: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toFixed(decimalPlaces).replace(/\.?0+$/, '');
}

export function applyKeypadInput(
  currentDraft: string,
  key: PaymentKeypadKey,
  decimalPlaces: number
): string {
  if (key === 'backspace') {
    return currentDraft.slice(0, -1);
  }

  if (key === 'clear') {
    return '';
  }

  if (key === '+10' || key === '+20' || key === '+50') {
    const increment = Number.parseInt(key.slice(1), 10);
    return formatDecimalDraft(parseDecimalDraft(currentDraft) + increment, decimalPlaces);
  }

  if (key === '.') {
    if (currentDraft.includes('.')) return currentDraft;
    return currentDraft === '' ? '0.' : `${currentDraft}.`;
  }

  return sanitizeDecimalDraft(`${currentDraft}${key}`, decimalPlaces);
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
  finalTotal: number,
  preferred: OutstandingPolicy = 'PAY_ON_COLLECTION'
): OutstandingPolicy {
  if (amountToCharge >= finalTotal - 0.001) return 'NONE';
  return preferred;
}

export function getLegOrderCap(
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  finalTotal: number
): number {
  const otherLegsTotal = paymentLegs.reduce(
    (sum, leg, legIdx) => sum + (legIdx === idx ? 0 : (leg.amount || 0)),
    0
  );

  return Math.max(0, finalTotal - otherLegsTotal);
}

export function getSuggestedStoredValueAmount(
  availableBalance: number,
  currentSettled: number,
  finalTotal: number,
  decimalPlaces: number
): number {
  return Number.parseFloat(
    Math.max(0, Math.min(availableBalance, finalTotal - currentSettled)).toFixed(decimalPlaces)
  );
}

export function getWalletLegMaxAmount(
  walletBalance: number,
  paymentLegs: Array<{ amount?: number }>,
  idx: number,
  finalTotal: number,
  decimalPlaces: number
): number {
  return Number.parseFloat(
    Math.max(0, Math.min(walletBalance, getLegOrderCap(paymentLegs, idx, finalTotal))).toFixed(decimalPlaces)
  );
}

export function walletLegExceedsBalance(
  appliedAmount: number,
  availableBalance: number,
  epsilon = 0.001
): boolean {
  return appliedAmount - availableBalance > epsilon;
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
