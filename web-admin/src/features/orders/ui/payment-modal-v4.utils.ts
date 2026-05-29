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
