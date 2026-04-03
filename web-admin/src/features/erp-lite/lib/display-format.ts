export interface ErpLiteDisplayConfig {
  locale: string
  currencyCode: string
  decimalPlaces: number
}

export function resolveErpLiteIntlLocale(locale: string) {
  return locale === 'ar' ? 'ar-OM' : 'en-OM'
}

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

export function formatErpLiteNumber(value: number, locale: string) {
  return new Intl.NumberFormat(resolveErpLiteIntlLocale(locale)).format(value)
}

export function formatErpLiteExchangeRate(
  value: number,
  { locale, decimalPlaces }: Pick<ErpLiteDisplayConfig, 'locale' | 'decimalPlaces'>,
) {
  return new Intl.NumberFormat(resolveErpLiteIntlLocale(locale), {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value)
}
