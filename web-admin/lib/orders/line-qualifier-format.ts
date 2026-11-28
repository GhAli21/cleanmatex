/**
 * Text of a line qualifier for renderers that print plain text (receipts, prints, tracking, the money view):
 * "1.8 kg · billed 3 kg (minimum) × 1.200 OMR · Express (2)". The parts come from `orderLineQualifiers`;
 * this only words them in the reader's language. What is billed is never left out: a line charged for more
 * than was measured says so wherever it is shown.
 * @module orders
 */
import { formatQty, type FormatQtyOptions } from '@/lib/uom/format';
import type { LineQualifier, LineQualifierMeasure } from './line-qualifier';

/** Translator of the `uom` namespace (`useTranslations('uom')` or `createTranslator`). */
export type LineQualifierTranslator = (
  key: 'line.billed' | 'line.billedMinimum' | 'line.billedStep',
  values: Record<string, string>,
) => string;

/** Formatting options: the wording, the reader's locale and the numeral options of `formatQty`. */
export interface LineQualifierTextOptions extends Pick<FormatQtyOptions, 'locale' | 'numberScript' | 'groupingLocale'> {
  t: LineQualifierTranslator;
  /** Pass it where the page has no unit-price column; the price then follows the billed quantity. */
  formatUnitPrice?: (unitPrice: string) => string;
}

/** Why a line is billed for something other than what was measured; null when billed as measured. */
export type BilledReason = 'MINIMUM' | 'STEP' | 'OTHER' | null;

/**
 * @param measure the measured part of a qualifier
 * @returns the reason the billed quantity differs from the measured one
 * @example billedReason({ ...measure, qty: '1.8', billedQty: '3', minBillableQty: '3' }); // 'MINIMUM'
 */
export function billedReason(measure: LineQualifierMeasure): BilledReason {
  const { qty, billedQty, minBillableQty, billingIncrement } = measure;
  if (billedQty == null || Number(billedQty) === Number(qty)) return null;
  if (minBillableQty != null && Number(qty) < Number(minBillableQty)) return 'MINIMUM';
  return billingIncrement != null ? 'STEP' : 'OTHER';
}

/**
 * @param measure the measured part of a qualifier
 * @param options wording, locale, numerals and the optional unit-price formatter
 * @returns e.g. "3.2 kg · billed 3.5 kg (per 0.5 kg)"
 */
export function formatLineMeasure(measure: LineQualifierMeasure, options: LineQualifierTextOptions): string {
  const unit = { symbol: measure.symbol, symbol2: measure.symbol2, qtyDecimals: measure.qtyDecimals };
  const qty = (value: string) => formatQty(value, unit, options);
  const reason = billedReason(measure);
  let text = qty(measure.qty);
  if (reason) {
    const billed = qty(measure.billedQty as string);
    if (reason === 'MINIMUM') text += ` · ${options.t('line.billedMinimum', { qty: billed })}`;
    else if (reason === 'STEP') text += ` · ${options.t('line.billedStep', { qty: billed, step: qty(measure.billingIncrement as string) })}`;
    else text += ` · ${options.t('line.billed', { qty: billed })}`;
  }
  if (options.formatUnitPrice && measure.unitPrice != null) text += ` × ${options.formatUnitPrice(measure.unitPrice)}`;
  return text;
}

/**
 * @param qualifier the line's parts (absent parts are skipped)
 * @param options wording, locale and numeral options
 * @returns e.g. "2.5 m · Express (1)"; an empty string when the line has nothing to say
 */
export function formatLineQualifier(qualifier: LineQualifier | undefined, options: LineQualifierTextOptions): string {
  if (!qualifier) return '';
  const parts: string[] = [];
  const { measure, speedCode, speedName, ordinal } = qualifier;
  if (measure) parts.push(formatLineMeasure(measure, options));
  if (speedCode) parts.push(options.locale === 'ar' && speedName?.name2 ? speedName.name2 : speedName?.name ?? speedCode);
  const text = parts.join(' · ');
  if (ordinal == null) return text;
  return text ? `${text} (${ordinal})` : `(${ordinal})`;
}
