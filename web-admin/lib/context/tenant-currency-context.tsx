'use client'

/**
 * Resolved tenant money settings (TENANT_CURRENCY, TENANT_DECIMAL_PLACES) for dashboard UI.
 * Loaded once per tenant session; refreshes when `currentTenant` changes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocale } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config'
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults'
import {
  formatMoneyAmount,
  formatMoneyAmountWithCode,
  roundMoneyAmount,
  type MoneyLocale,
} from '@/lib/money/format-money'

export interface TenantCurrencyContextValue {
  currencyCode: string
  decimalPlaces: number
  currencyExRate: number
  /** False only while first fetch runs for an authenticated tenant */
  isReady: boolean
  formatMoney: (amount: number) => string
  /** Same digits as formatMoney but `12.500 OMR` style */
  formatMoneyWithCode: (amount: number) => string
  roundMoney: (amount: number) => number
  refresh: () => Promise<void>
}

const TenantCurrencyContext = createContext<TenantCurrencyContextValue | null>(null)

function toMoneyLocale(locale: string): MoneyLocale {
  return locale === 'ar' ? 'ar' : 'en'
}

export function TenantCurrencyProvider({ children }: { children: ReactNode }) {
  const { currentTenant, user, isLoading } = useAuth()
  const intlLocale = useLocale()
  const moneyLocale = toMoneyLocale(intlLocale)

  const [currencyCode, setCurrencyCode] = useState<string>(ORDER_DEFAULTS.CURRENCY)
  const [decimalPlaces, setDecimalPlaces] = useState<number>(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES)
  const [currencyExRate, setCurrencyExRate] = useState(1)
  const [isReady, setIsReady] = useState(!currentTenant)

  const load = useCallback(async () => {
    if (!currentTenant?.tenant_id) {
      setCurrencyCode(ORDER_DEFAULTS.CURRENCY)
      setDecimalPlaces(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES)
      setCurrencyExRate(1)
      setIsReady(true)
      return
    }
    setIsReady(false)
    try {
      const cfg = await getCurrencyConfigAction(
        currentTenant.tenant_id,
        undefined,
        user?.id
      )
      setCurrencyCode(cfg.currencyCode || ORDER_DEFAULTS.CURRENCY)
      setDecimalPlaces(
        Number.isFinite(cfg.decimalPlaces) && cfg.decimalPlaces >= 0
          ? cfg.decimalPlaces
          : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
      )
      setCurrencyExRate(
        typeof cfg.currencyExRate === 'number' && Number.isFinite(cfg.currencyExRate)
          ? cfg.currencyExRate
          : 1
      )
    } catch {
      setCurrencyCode(ORDER_DEFAULTS.CURRENCY)
      setDecimalPlaces(ORDER_DEFAULTS.PRICE.DECIMAL_PLACES)
      setCurrencyExRate(1)
    } finally {
      setIsReady(true)
    }
  }, [currentTenant?.tenant_id, user?.id])

  useEffect(() => {
    if (isLoading) return
    void load()
  }, [isLoading, load])

  const formatMoney = useCallback(
    (amount: number) =>
      formatMoneyAmount(amount, {
        currencyCode,
        decimalPlaces,
        locale: moneyLocale,
      }),
    [currencyCode, decimalPlaces, moneyLocale]
  )

  const formatMoneyWithCodeCb = useCallback(
    (amount: number) =>
      formatMoneyAmountWithCode(amount, {
        currencyCode,
        decimalPlaces,
        locale: moneyLocale,
      }),
    [currencyCode, decimalPlaces, moneyLocale]
  )

  const roundMoney = useCallback(
    (amount: number) => roundMoneyAmount(amount, decimalPlaces),
    [decimalPlaces]
  )

  const value = useMemo<TenantCurrencyContextValue>(
    () => ({
      currencyCode,
      decimalPlaces,
      currencyExRate,
      isReady,
      formatMoney,
      formatMoneyWithCode: formatMoneyWithCodeCb,
      roundMoney,
      refresh: load,
    }),
    [
      currencyCode,
      currencyExRate,
      decimalPlaces,
      formatMoney,
      formatMoneyWithCodeCb,
      isReady,
      load,
      roundMoney,
    ]
  )

  return (
    <TenantCurrencyContext.Provider value={value}>{children}</TenantCurrencyContext.Provider>
  )
}

export function useTenantCurrency(): TenantCurrencyContextValue {
  const ctx = useContext(TenantCurrencyContext)
  if (!ctx) {
    const moneyLocale: MoneyLocale = 'en'
    const currencyCode = ORDER_DEFAULTS.CURRENCY
    const decimalPlaces = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
    return {
      currencyCode,
      decimalPlaces,
      currencyExRate: 1,
      isReady: true,
      formatMoney: (amount: number) =>
        formatMoneyAmount(amount, { currencyCode, decimalPlaces, locale: moneyLocale }),
      formatMoneyWithCode: (amount: number) =>
        formatMoneyAmountWithCode(amount, { currencyCode, decimalPlaces, locale: moneyLocale }),
      roundMoney: (amount: number) => roundMoneyAmount(amount, decimalPlaces),
      refresh: async () => {},
    }
  }
  return ctx
}
