'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Turns whatever a cash-drawer API call threw into text a cashier can act on.
 *
 * The cash-drawer API reports every refusal as a stable code (`CASH_COUNT_REQUIRED`,
 * `DRAWER_SESSION_ALREADY_OPEN`, ...; plan §4B.11) and the API client rethrows it as
 * `Error(code)`. Showing that code would leak an English constant into an Arabic screen, so
 * known codes resolve through `cashControl.ledgerErrors` and anything else falls back to the
 * caller's own, already-translated message — a raw server string is never shown.
 *
 * @returns `(error, fallback) => message` — `fallback` must already be i18n-resolved.
 * @example
 * const errorMessage = useCashDrawerErrorMessage()
 * cmxMessage.error(errorMessage(error, t('messages.closeFailed')))
 */
export function useCashDrawerErrorMessage(): (error: unknown, fallback: string) => string {
  const tLedger = useTranslations('cashControl.ledgerErrors')
  return useCallback(
    (error: unknown, fallback: string) => {
      const code = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
      const key = code as Parameters<typeof tLedger>[0]
      return code && tLedger.has(key) ? tLedger(key) : fallback
    },
    [tLedger],
  )
}
