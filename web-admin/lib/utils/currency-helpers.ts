/**
 * Currency Helpers
 * Utilities for currency formatting and parsing
 */

import { formatCurrency as formatCurrencyUtil, getCurrentLocale } from './rtl';

/**
 * Default currency code
 */
const DEFAULT_CURRENCY = 'OMR';

/**
 * Formats currency amount for display
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'OMR')
 * @param locale - Locale override (optional)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale?: 'en' | 'ar'
): string {
  return formatCurrencyUtil(amount, currency, locale);
}

/**
 * Formats currency for current locale
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'OMR')
 * @returns Formatted currency string
 */
export function formatCurrencyForCurrentLocale(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const locale = getCurrentLocale();
  return formatCurrency(amount, currency, locale);
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
 * Validates currency code
 * @param currency - Currency code to validate
 * @returns True if valid, false otherwise
 */
export function isValidCurrencyCode(currency: string): boolean {
  const validCodes = ['OMR', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];
  return validCodes.includes(currency.toUpperCase());
}

