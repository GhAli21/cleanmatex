'use client'

/**
 * Internationalization Provider
 *
 * Wraps the app with next-intl's client-side provider
 * Supports English and Arabic with RTL
 */

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode } from 'react'

interface IntlProviderProps {
  locale: string
  messages: any
  children: ReactNode
}

export function IntlProvider({ locale, messages, children }: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
      {children}
    </NextIntlClientProvider>
  )
}
