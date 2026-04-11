/**
 * Currency Helpers
 * Utilities for currency formatting and parsing
 */

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { formatCurrency as formatCurrencyUtil, getCurrentLocale } from './rtl';

export { formatMoneyAmount, roundMoneyAmount } from '@/lib/money/format-money';

const DEFAULT_CURRENCY = ORDER_DEFAULTS.CURRENCY;

/**
 * Formats currency amount for display
 * @param amount - Amount to format
 * @param currency - Currency code (default: tenant default from ORDER_DEFAULTS)
 * @param locale - Locale override (optional)
 * @param decimalPlaces - Fraction digits from tenant settings when known
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale?: 'en' | 'ar',
  decimalPlaces: number = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
): string {
  return formatCurrencyUtil(amount, currency, locale, decimalPlaces);
}

/**
 * Formats currency for current locale
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'OMR')
 * @returns Formatted currency string
 */
export function formatCurrencyForCurrentLocale(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  decimalPlaces: number = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
): string {
  const locale = getCurrentLocale();
  return formatCurrency(amount, currency, locale, decimalPlaces);
}

/**
 * Parses currency string to number
 * @param currencyString - Currency string to parse
 * @returns Parsed number or NaN if invalid
 */
export function parseCurrency(currencyString: string): number {
  // Remove currency symbols and spaces
  const cleaned = currencyString
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '')
    .trim();

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? NaN : parsed;
}

/**
 * Gets currency symbol
 * @param currency - Currency code (default: 'OMR')
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const symbols: Record<string, string> = {
    OMR: 'ر.ع.',
    USD: '$',
    EUR: '€',
    GBP: '£',
    SAR: 'ر.س',
    AED: 'د.إ',
  };

  return symbols[currency] || currency;
}

/**
 * Validates currency code (ISO 4217 alphabetic, case-insensitive).
 * Avoids rejecting tenant-configured codes that are valid for Intl but not in a short allowlist.
 */
export function isValidCurrencyCode(currency: string): boolean {
  const c = currency?.trim();
  return /^[A-Za-z]{3}$/.test(c);
}

