'use client'

/**
 * App Providers
 *
 * Centralized provider wrapper for client-side contexts
 * Includes QueryClientProvider, AuthProvider, RoleProvider, and Toaster for notifications
 * Supports dynamic locale switching with RTL support
 */

import { useState, useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { AuthProvider } from '@/lib/auth/auth-context'
import { TenantCurrencyProvider } from '@/lib/context/tenant-currency-context'
import { RoleProvider } from '@/lib/auth/role-context'
import { Toaster } from 'sonner'
import { AlertDialogProvider } from '@ui/feedback'
import { type Locale, getLocaleFromLocalStorage } from '@/lib/utils/locale.client'
import enMessages from '@/messages/en.json'
import arMessages from '@/messages/ar.json'

function getInitialClientLocale(initialLocale: Locale): Locale {
  if (typeof window === 'undefined') {
    return initialLocale
  }

  return getLocaleFromLocalStorage()
}

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocale
 */
export function AppProviders({
  children,
  initialLocale = 'en'
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  // Create QueryClient instance with default options
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // Manage locale state with initial value from server
  const [locale, setLocaleState] = useState<Locale>(() => getInitialClientLocale(initialLocale));

  // Sync with localStorage and listen for locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';

    // Listen for locale change events from LanguageSwitcher
    const handleLocaleChange = (event: CustomEvent<Locale>) => {
      setLocaleState(event.detail);
    };

    window.addEventListener('localeChange', handleLocaleChange as EventListener);

    return () => {
      window.removeEventListener('localeChange', handleLocaleChange as EventListener);
    };
  }, [locale]);

  // Select messages based on current locale
  const messages = locale === 'ar' ? arMessages : enMessages;

  // RTL-aware toast position
  const toastPosition = locale === 'ar' ? 'top-left' : 'top-right';

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
        <AuthProvider>
          <TenantCurrencyProvider>
            <RoleProvider>
              <AlertDialogProvider>
                {children}
                <Toaster position={toastPosition} richColors />
              </AlertDialogProvider>
            </RoleProvider>
          </TenantCurrencyProvider>
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}
