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

export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
      {/* @ts-expect-error - React version mismatch between React 18/19 types */}
      {children}
    </NextIntlClientProvider>
  )
}
