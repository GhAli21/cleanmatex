/**
 * Server-side Locale Utilities for CleanMateX
 *
 * IMPORTANT: Only use these functions in Server Components
 * For client components, use locale.client.ts
 */

import { cookies } from 'next/headers';

export type Locale = 'en' | 'ar';

/**
 * Get locale from cookies (server-side only)
 *
 * @returns Current locale from cookies, defaults to 'en'
 */
export async function getLocaleFromCookies(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale');

  if (localeCookie && (localeCookie.value === 'en' || localeCookie.value === 'ar')) {
    return localeCookie.value as Locale;
  }

  return 'en'; // Default to English
}
