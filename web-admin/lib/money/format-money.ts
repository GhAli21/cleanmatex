/**
 * Tenant money formatting and rounding.
 * Uses ISO currency + fraction digits from tenant settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES).
 */

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 *
 */
export type MoneyLocale = 'en' | 'ar';

/**
 *
 */
export interface FormatMoneyOptions {
  currencyCode: string;
  decimalPlaces: number;
  /** UI locale for digit grouping and script; defaults to en */
  locale?: MoneyLocale;
}

/**
 * A3-4 (POS Session & Cash Drawer Hardening): the cash-drawer/POS-session
 * APIs now serialize money as an exact fixed-point string, never a JS
 * number, so every formatter here accepts either — a display-only boundary
 * is the one place converting a money string to a JS number is acceptable
 * (nothing downstream computes on the result further).
 */
export type MoneyAmountInput = number | string;

function coerceAmount(amount: MoneyAmountInput): number {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  return Number.isFinite(num) ? num : 0;
}

/**
 * BCP 47 locale for Intl when UI is EN vs AR (GCC-style).
 * @param locale
 */
export function resolveMoneyIntlLocale(locale?: MoneyLocale): string {
  return locale === 'ar' ? 'ar' : 'en';
}

function clampDecimalPlaces(decimalPlaces: number): number {
  if (!Number.isFinite(decimalPlaces) || decimalPlaces < 0) {
    return ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
  }
  return Math.min(Math.floor(decimalPlaces), 20);
}

/**
 * Round a monetary amount to tenant decimal places (half-up via Number.toFixed).
 * @param amount
 * @param decimalPlaces
 */
export function roundMoneyAmount(amount: MoneyAmountInput, decimalPlaces: number): number {
  const dp = clampDecimalPlaces(decimalPlaces);
  return Number(coerceAmount(amount).toFixed(dp));
}

/**
 * Format a monetary amount with Intl (currency style). Falls back to `CODE amount` if Intl rejects the code.
 * B15: an unresolved (blank) currency renders as a plain localized number —
 * never an invented default currency.
 * @param amount
 * @param options
 */
export function formatMoneyAmount(amount: MoneyAmountInput, options: FormatMoneyOptions): string {
  const cc = options.currencyCode?.trim() ?? '';
  const dp = clampDecimalPlaces(options.decimalPlaces);
  const intlLocale = resolveMoneyIntlLocale(options.locale);
  const num = coerceAmount(amount);
  if (!cc) {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(num);
  }
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: cc,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(num);
  } catch {
    return `${cc} ${num.toFixed(dp)}`;
  }
}

/**
 * Format amount with currency code suffix (no Intl symbol), e.g. `12.500 OMR`.
 * Use for compact tables or when Intl currency symbol is undesired.
 * @param amount
 * @param options
 */
export function formatMoneyAmountWithCode(
  amount: MoneyAmountInput,
  options: FormatMoneyOptions
): string {
  const cc = options.currencyCode?.trim() ?? '';
  const dp = clampDecimalPlaces(options.decimalPlaces);
  const intlLocale = resolveMoneyIntlLocale(options.locale);
  const num = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(coerceAmount(amount));
  // B15: no invented currency — a blank code renders the bare number.
  return cc ? `${num} ${cc}` : num;
}
