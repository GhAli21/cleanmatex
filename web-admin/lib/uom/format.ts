/**
 * Quantity formatting with a unit symbol ("2.4 kg", "٢٫٤ كغ").
 *
 * Display only: the value is shown with up to the unit's decimals (trailing
 * zeros dropped) in the Organization's numeral script and grouping, followed by
 * the symbol of the UI language. Uses the shared number formatter so quantities
 * and money read the same way.
 */
import { formatNumberForLocale, type MoneyAmountInput, type MoneyLocale } from '@/lib/money/format-money';
import type { NumberGroupingLocale, NumberScript } from '@/lib/constants/tenant-extra-config';
import type { UomDisplayFacts } from '@/lib/types/uom';

/** Options for `formatQty`. */
export interface FormatQtyOptions {
  locale?: MoneyLocale;
  numberScript?: NumberScript;
  groupingLocale?: NumberGroupingLocale;
  /** Show exactly the unit's decimals (e.g. "2.400 kg") instead of trimming. */
  fixedDecimals?: boolean;
  /** Omit the symbol (the column header already says the unit). */
  withoutSymbol?: boolean;
}

/**
 * The symbol for the UI language: Arabic when present, else English.
 * @param unit the unit or line snapshot
 * @param locale UI locale
 * @returns the symbol to show
 */
export function uomSymbol(unit: Pick<UomDisplayFacts, 'symbol' | 'symbol2'>, locale: MoneyLocale = 'en'): string {
  return locale === 'ar' && unit.symbol2 ? unit.symbol2 : unit.symbol;
}

/**
 * Formats a quantity with its unit symbol.
 * @param value the quantity (decimal string preferred)
 * @param unit symbol, Arabic symbol and decimals (a unit or an order-line snapshot)
 * @param options locale, numeral script, grouping, fixed decimals, no symbol
 * @returns e.g. "2.4 kg"
 * @example
 * formatQty('2.400000', { symbol: 'kg', symbol2: 'كغ', qtyDecimals: 3 }); // '2.4 kg'
 */
export function formatQty(value: MoneyAmountInput, unit: UomDisplayFacts, options: FormatQtyOptions = {}): string {
  const number = formatNumberForLocale(value, {
    locale: options.locale,
    numberScript: options.numberScript,
    groupingLocale: options.groupingLocale,
    minimumFractionDigits: options.fixedDecimals ? unit.qtyDecimals : 0,
    maximumFractionDigits: unit.qtyDecimals,
  });
  return options.withoutSymbol ? number : `${number} ${uomSymbol(unit, options.locale)}`;
}
