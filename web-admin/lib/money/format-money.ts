/**
 * Tenant money formatting and rounding.
 * Uses ISO currency + fraction digits from tenant settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES).
 */

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

export type MoneyLocale = 'en' | 'ar';

export interface FormatMoneyOptions {
  currencyCode: string;
  decimalPlaces: number;
  /** UI locale for digit grouping and script; defaults to en */
  locale?: MoneyLocale;
}

/** BCP 47 locale for Intl when UI is EN vs AR (GCC-style). */
export function resolveMoneyIntlLocale(locale?: MoneyLocale): string {
  return locale === 'ar' ? 'ar-OM' : 'en-OM';
}

function clampDecimalPlaces(decimalPlaces: number): number {
  if (!Number.isFinite(decimalPlaces) || decimalPlaces < 0) {
    return ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
  }
  return Math.min(Math.floor(decimalPlaces), 20);
}

/**
 * Round a monetary amount to tenant decimal places (half-up via Number.toFixed).
 */
export function roundMoneyAmount(amount: number, decimalPlaces: number): number {
  const dp = clampDecimalPlaces(decimalPlaces);
  return Number(Number(amount).toFixed(dp));
}

/**
 * Format a monetary amount with Intl (currency style). Falls back to `CODE amount` if Intl rejects the code.
 */
export function formatMoneyAmount(amount: number, options: FormatMoneyOptions): string {
  const cc = (options.currencyCode || ORDER_DEFAULTS.CURRENCY).trim() || ORDER_DEFAULTS.CURRENCY;
  const dp = clampDecimalPlaces(options.decimalPlaces);
  const intlLocale = resolveMoneyIntlLocale(options.locale);
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: cc,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(amount);
  } catch {
    return `${cc} ${Number(amount).toFixed(dp)}`;
  }
}

/**
 * Format amount with currency code suffix (no Intl symbol), e.g. `12.500 OMR`.
 * Use for compact tables or when Intl currency symbol is undesired.
 */
export function formatMoneyAmountWithCode(
  amount: number,
  options: FormatMoneyOptions
): string {
  const cc = (options.currencyCode || ORDER_DEFAULTS.CURRENCY).trim() || ORDER_DEFAULTS.CURRENCY;
  const dp = clampDecimalPlaces(options.decimalPlaces);
  const intlLocale = resolveMoneyIntlLocale(options.locale);
  const num = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(amount);
  return `${num} ${cc}`;
}
