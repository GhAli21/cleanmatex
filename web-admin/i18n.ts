import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

// Our supported locales
export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  // Get locale from headers set by middleware
  const headersList = await headers();
  const locale = (headersList.get('x-next-intl-locale') as Locale) || defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
