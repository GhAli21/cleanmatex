'use client'

/**
 * Internationalization Provider
 *
 * Wraps the app with next-intl's client-side provider
 * Supports English and Arabic with RTL
 */

import { NextIntlClientProvider } from 'next-intl'
import type React from 'react'

interface IntlProviderProps {
  locale: string
  messages: Record<string, unknown>
  children: React.ReactNode
}

/**
 *
 * @param root0
 * @param root0.locale
 * @param root0.messages
 * @param root0.children
 */
export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
      {children}
    </NextIntlClientProvider>
  )
}
