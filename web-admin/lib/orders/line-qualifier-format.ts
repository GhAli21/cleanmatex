/**
 * Text of a line qualifier ("2.5 m · Express (2)") for renderers that print plain text (receipts, prints, tracking,
 * the money view). The parts come from `orderLineQualifiers`; this only joins them in the reader's language.
 * @module orders
 */
import { formatQty, type FormatQtyOptions } from '@/lib/uom/format';
import type { LineQualifier } from './line-qualifier';

/** Formatting options: the reader's locale and the numeral options of `formatQty`. */
export type LineQualifierTextOptions = Pick<FormatQtyOptions, 'locale' | 'numberScript' | 'groupingLocale'>;

/**
 * @param qualifier the line's parts (absent parts are skipped)
 * @param options locale and numeral options
 * @returns e.g. "2.5 m · Express (1)"; an empty string when the line has nothing to say
 */
export function formatLineQualifier(qualifier: LineQualifier | undefined, options: LineQualifierTextOptions = {}): string {
  if (!qualifier) return '';
  const parts: string[] = [];
  const { measure, speedCode, speedName, ordinal } = qualifier;
  if (measure) {
    parts.push(formatQty(measure.qty, { symbol: measure.symbol, symbol2: measure.symbol2, qtyDecimals: measure.qtyDecimals }, options));
  }
  if (speedCode) parts.push(options.locale === 'ar' && speedName?.name2 ? speedName.name2 : speedName?.name ?? speedCode);
  const text = parts.join(' · ');
  if (ordinal == null) return text;
  return text ? `${text} (${ordinal})` : `(${ordinal})`;
}
