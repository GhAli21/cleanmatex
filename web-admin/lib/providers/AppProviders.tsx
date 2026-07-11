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
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { AuthProvider } from '@/lib/auth/auth-context'
import { TenantCurrencyProvider } from '@/lib/context/tenant-currency-context'
import { RoleProvider } from '@/lib/auth/role-context'
import { Toaster } from 'sonner'
import { AlertDialogProvider } from '@ui/feedback'
import { PermissionsInspectorProvider } from '@ui/navigation/permissions-inspector'
import { type Locale } from '@/lib/utils/locale.client'

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.locale
 * @param root0.messages
 */
export function AppProviders({
  children,
  locale = 'en',
  messages,
}: {
  children: ReactNode;
  locale?: Locale;
  messages: AbstractIntlMessages;
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

  // Keep document language and direction aligned with the server-provided locale.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  // RTL-aware toast position
  const toastPosition = locale === 'ar' ? 'top-left' : 'top-right';

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
        <AuthProvider>
          <TenantCurrencyProvider>
            <RoleProvider>
              <AlertDialogProvider>
                <PermissionsInspectorProvider>
                  {children}
                  <Toaster position={toastPosition} richColors closeButton />
                </PermissionsInspectorProvider>
              </AlertDialogProvider>
            </RoleProvider>
          </TenantCurrencyProvider>
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}
