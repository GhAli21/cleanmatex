/**
 *
 */
export interface ErpLiteDisplayConfig {
  locale: string
  currencyCode: string
  decimalPlaces: number
}

/**
 *
 * @param locale
 */
export function resolveErpLiteIntlLocale(locale: string) {
  return locale === 'ar' ? 'ar' : 'en'
}

/**
 *
 * @param value
 * @param root0
 * @param root0.locale
 * @param root0.currencyCode
 * @param root0.decimalPlaces
 */
export function formatErpLiteMoney(
  value: number,
  { locale, currencyCode, decimalPlaces }: ErpLiteDisplayConfig,
) {
  return new Intl.NumberFormat(resolveErpLiteIntlLocale(locale), {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'code',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value)
}

/**
 *
 * @param value
 * @param locale
 */
export function formatErpLiteNumber(value: number, locale: string) {
  return new Intl.NumberFormat(resolveErpLiteIntlLocale(locale)).format(value)
}

/**
 *
 * @param value
 * @param root0
 * @param root0.locale
 * @param root0.decimalPlaces
 */
export function formatErpLiteExchangeRate(
  value: number,
  { locale, decimalPlaces }: Pick<ErpLiteDisplayConfig, 'locale' | 'decimalPlaces'>,
) {
  return new Intl.NumberFormat(resolveErpLiteIntlLocale(locale), {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value)
}

/**
 * Read-only rate stored on a purchase document, with the book date and source when the currency is foreign.
 * Uses up to 10 fraction digits so a rate is not rounded to the money scale.
 * @param rate - Exact decimal string from the document (`1` when currencies match)
 * @param rateDate - Rate-book date, or null for a same-currency document
 * @param rateSource - `TENANT:CBO` or `HQ:ECB`, or null for a same-currency document
 * @param locale - Active UI locale
 * @returns The rate, and the date and source when they were stored
 */
export function formatErpLiteDocumentRate(
  rate: string,
  rateDate: string | null,
  rateSource: string | null,
  locale: string,
): string {
  const value = Number(rate)
  const formatted = Number.isFinite(value)
    ? new Intl.NumberFormat(resolveErpLiteIntlLocale(locale), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 10,
    }).format(value)
    : rate
  if (!rateDate) return formatted
  return rateSource ? `${formatted} · ${rateDate} · ${rateSource}` : `${formatted} · ${rateDate}`
}
