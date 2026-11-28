/**
 * Tenant money formatting and rounding.
 * Uses ISO currency + fraction digits from tenant settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES).
 */

import { UNIT_PRICE_DECIMALS } from '@/lib/constants/uom';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import {
  DEFAULT_RESOLVED_EXTRA_CONFIG,
  NUMBER_GROUPING_LOCALES,
  NUMBER_SCRIPTS,
  type NumberGroupingLocale,
  type NumberScript,
} from '@/lib/constants/tenant-extra-config';

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
  /** Optional numeral script override ('LATN' = 123 GCC default, 'ARAB' = ١٢٣). */
  numberScript?: NumberScript;
  /** Optional grouping/decimal separator convention ('EN_US' | 'AR_LATN' | 'AR_NATIVE'). */
  groupingLocale?: NumberGroupingLocale;
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
 * When `script` or `grouping` options are omitted, keeps legacy `'en' | 'ar'`
 * return values; when provided (or inside formatting calls), respects
 * `NUMBER_SCRIPT` ('LATN' GCC default vs 'ARAB') and `NUMBER_GROUPING_LOCALE`.
 * @param locale
 * @param scriptOpts
 */
export function resolveMoneyIntlLocale(
  locale?: MoneyLocale,
  scriptOpts?: {
    numberScript?: NumberScript;
    groupingLocale?: NumberGroupingLocale;
  }
): string {
  if (!scriptOpts || (scriptOpts.numberScript === undefined && scriptOpts.groupingLocale === undefined)) {
    return locale === 'ar' ? 'ar' : 'en';
  }
  const script = scriptOpts.numberScript ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript;
  const grouping = scriptOpts.groupingLocale ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberGroupingLocale;
  if (script === NUMBER_SCRIPTS.ARAB || grouping === NUMBER_GROUPING_LOCALES.AR_NATIVE) {
    return locale === 'ar' ? 'ar-u-nu-arab' : 'en-u-nu-arab';
  }
  if (grouping === NUMBER_GROUPING_LOCALES.AR_LATN) {
    return locale === 'ar' ? 'ar-u-nu-latn' : 'en-u-nu-latn';
  }
  // EN_US + LATN: standard Western 123 digits with dot decimal & comma grouping
  return 'en-US';
}

function clampDecimalPlaces(decimalPlaces: number): number {
  if (!Number.isFinite(decimalPlaces) || decimalPlaces < 0) {
    return ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
  }
  return Math.min(Math.floor(decimalPlaces), 20);
}

/**
 * Half-up for an exact decimal string. Number.toFixed is not used here because
 * binary values such as 1.005 round the wrong way.
 */
function roundHalfUpDecimalText(value: string, decimalPlaces: number): number | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const whole = BigInt(match[2]);
  const fraction = match[3] ?? '';
  if (decimalPlaces === 0) {
    const bump = (fraction[0] ?? '0') >= '5' ? 1n : 0n;
    return sign * Number(whole + bump);
  }
  const scale = 10n ** BigInt(decimalPlaces);
  const digits = (fraction + '0'.repeat(decimalPlaces + 1)).slice(0, decimalPlaces + 1);
  const keep = BigInt(digits.slice(0, decimalPlaces) || '0');
  const bump = digits[decimalPlaces] >= '5' ? 1n : 0n;
  const scaled = whole * scale + keep + bump;
  const roundedWhole = scaled / scale;
  const roundedFraction = (scaled % scale).toString().padStart(decimalPlaces, '0');
  return sign * Number(`${roundedWhole.toString()}.${roundedFraction}`);
}

/**
 * Round a monetary amount to tenant decimal places (half-up via Number.toFixed).
 * Exact decimal strings use decimal half-up so a review display does not depend on binary rounding.
 * @param amount
 * @param decimalPlaces
 */
export function roundMoneyAmount(amount: MoneyAmountInput, decimalPlaces: number): number {
  const dp = clampDecimalPlaces(decimalPlaces);
  if (typeof amount === 'string') {
    const exact = roundHalfUpDecimalText(amount, dp);
    if (exact !== null) return exact;
  }
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
  const intlLocale = resolveMoneyIntlLocale(options.locale, {
    numberScript: options.numberScript ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript,
    groupingLocale: options.groupingLocale ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberGroupingLocale,
  });
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
  const intlLocale = resolveMoneyIntlLocale(options.locale, {
    numberScript: options.numberScript ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript,
    groupingLocale: options.groupingLocale ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberGroupingLocale,
  });
  const num = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(coerceAmount(amount));
  // B15: no invented currency — a blank code renders the bare number.
  return cc ? `${num} ${cc}` : num;
}

/**
 * A price of one unit (per kg, per m²): at least the currency's decimals, up to the 6 a unit price
 * may carry (`UNIT_PRICE` class), so 0.045125 is not shown as 0.045.
 * @param amount the stored unit price
 * @param options currency, its decimals, locale and numeral options
 * @returns e.g. `1.200 OMR`, `0.045125 OMR`
 */
export function formatUnitPriceWithCode(amount: MoneyAmountInput, options: FormatMoneyOptions): string {
  const cc = options.currencyCode?.trim() ?? '';
  const dp = clampDecimalPlaces(options.decimalPlaces);
  const num = formatNumberForLocale(amount, {
    locale: options.locale,
    numberScript: options.numberScript,
    groupingLocale: options.groupingLocale,
    minimumFractionDigits: dp,
    maximumFractionDigits: Math.max(dp, UNIT_PRICE_DECIMALS),
  });
  return cc ? `${num} ${cc}` : num;
}

/**
 * Format a plain integer or decimal count using the Organization's numeral script
 * (`NUMBER_SCRIPT`: `'LATN'` vs `'ARAB'`) and grouping convention.
 * @param value - Number to format
 * @param options - Optional locale and extra-config numeral script / grouping overrides
 */
export function formatNumberForLocale(
  value: MoneyAmountInput,
  options?: {
    locale?: MoneyLocale;
    numberScript?: NumberScript;
    groupingLocale?: NumberGroupingLocale;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const intlLocale = resolveMoneyIntlLocale(options?.locale, {
    numberScript: options?.numberScript ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript,
    groupingLocale: options?.groupingLocale ?? DEFAULT_RESOLVED_EXTRA_CONFIG.numberGroupingLocale,
  });
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits,
  }).format(coerceAmount(value));
}
