'use client'

/**
 * The signed-in Organization's brand (logo and white-label app name), resolved
 * on the server by the root layout and read by the app shell. With no provider
 * (signed out, Storybook) the app is CleanMateX with no logo.
 * @module lib/theme/tenant-brand
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useLocale } from 'next-intl'

/** Brand values handed from the server. */
export interface TenantBrandValue {
  appName: string | null
  appName2: string | null
  logoUrl: string | null
  /** Dark-mode logo; null = none (the light logo shows in dark too). */
  logoDarkUrl?: string | null
}

const PRODUCT_NAME = 'CleanMateX'
const TenantBrandContext = createContext<TenantBrandValue | null>(null)

/**
 * Provides the Organization brand to the app shell.
 * @param props - value from the resolved theme, and children
 * @returns The provider
 */
export function TenantBrandProvider({ value, children }: { value: TenantBrandValue; children: ReactNode }) {
  return <TenantBrandContext.Provider value={value}>{children}</TenantBrandContext.Provider>
}

/**
 * The name to show for the app (white-label name in the current language, else CleanMateX) and the logo.
 * @returns name, logoUrl and logoDarkUrl (null = none)
 */
export function useTenantBrand(): { name: string; logoUrl: string | null; logoDarkUrl: string | null } {
  const brand = useContext(TenantBrandContext)
  const localized = useLocale() === 'ar' ? brand?.appName2 ?? brand?.appName : brand?.appName
  return { name: localized || PRODUCT_NAME, logoUrl: brand?.logoUrl ?? null, logoDarkUrl: brand?.logoDarkUrl ?? null }
}
