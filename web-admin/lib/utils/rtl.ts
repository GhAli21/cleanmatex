/**
 * RTL (Right-to-Left) Utility Functions
 *
 * Helper functions for handling RTL layouts
 */

/**
 * Check if current locale is RTL
 */
export function isRTL(): boolean {
  if (typeof window === 'undefined') return false
  return document.documentElement.dir === 'rtl'
}

/**
 * Get current locale from HTML
 */
export function getCurrentLocale(): 'en' | 'ar' {
  if (typeof window === 'undefined') return 'en'
  const lang = document.documentElement.lang
  return lang === 'ar' ? 'ar' : 'en'
}

/**
 * Get direction-aware class names for Tailwind
 * Example: getDirClass('ml-4', 'mr-4') returns 'ml-4' for LTR, 'mr-4' for RTL
 */
export function getDirClass(ltrClass: string, rtlClass: string): string {
  return isRTL() ? rtlClass : ltrClass
}

/**
 * Format number for current locale
 */
export function formatNumber(num: number, locale?: 'en' | 'ar'): string {
  const currentLocale = locale || getCurrentLocale()
  return new Intl.NumberFormat(currentLocale === 'ar' ? 'ar-OM' : 'en-OM').format(num)
}

/**
 * Format currency for current locale
 */
export function formatCurrency(
  amount: number,
  currency: string = 'OMR',
  locale?: 'en' | 'ar'
): string {
  const currentLocale = locale || getCurrentLocale()
  return new Intl.NumberFormat(currentLocale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount)
}

/**
 * Format date for current locale
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale?: 'en' | 'ar'
): string {
  const currentLocale = locale || getCurrentLocale()
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }

  return new Intl.DateTimeFormat(
    currentLocale === 'ar' ? 'ar-OM' : 'en-OM',
    defaultOptions
  ).format(dateObj)
}

/**
 * Format time for current locale
 */
export function formatTime(
  date: Date | string,
  locale?: 'en' | 'ar'
): string {
  const currentLocale = locale || getCurrentLocale()
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(currentLocale === 'ar' ? 'ar-OM' : 'en-OM', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj)
}

/**
 * Format datetime for current locale
 */
export function formatDateTime(
  date: Date | string,
  locale?: 'en' | 'ar'
): string {
  const currentLocale = locale || getCurrentLocale()
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(currentLocale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj)
}

/**
 * Get text alignment class based on locale
 */
export function getTextAlign(): string {
  return isRTL() ? 'text-right' : 'text-left'
}

/**
 * Get flex direction class for RTL
 */
export function getFlexDir(normalDir: 'row' | 'col' = 'row'): string {
  if (normalDir === 'col') return 'flex-col'
  return isRTL() ? 'flex-row-reverse' : 'flex-row'
}
