/**
 * Client-side Locale Utilities for CleanMateX
 *
 * IMPORTANT: Only use these functions in Client Components
 * For server components, use locale.server.ts
 */

'use client'

export type Locale = 'en' | 'ar';

/**
 * Get locale from localStorage (client-side only)
 *
 * @returns Current locale from localStorage, defaults to 'en'
 */
export function getLocaleFromLocalStorage(): Locale {
  if (typeof window === 'undefined') {
    return 'en'; // Server-side fallback
  }

  const savedLocale = localStorage.getItem('locale');

  if (savedLocale === 'en' || savedLocale === 'ar') {
    return savedLocale as Locale;
  }

  return 'en'; // Default to English
}

/**
 * Set locale in both localStorage and cookies
 *
 * @param locale - Locale to set ('en' or 'ar')
 */
export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;

  // Save to localStorage
  localStorage.setItem('locale', locale);

  // Save to cookie for server-side access
  document.cookie = `locale=${locale}; path=/; max-age=31536000`; // 1 year

  // Update HTML attributes immediately
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Check if current locale is RTL
 *
 * @returns true if current locale is 'ar' (RTL), false otherwise
 */
export function isRTLLocale(locale: Locale): boolean {
  return locale === 'ar';
}
