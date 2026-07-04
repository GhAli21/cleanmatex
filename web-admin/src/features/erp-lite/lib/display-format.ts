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
