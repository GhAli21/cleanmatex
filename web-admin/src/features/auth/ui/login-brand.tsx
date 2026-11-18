'use client'

/**
 * The last-used Organization's public brand for the login page, read on the
 * server from the `cmx_last_brand` cookie and handed down in the first render
 * (no flash). Null on a first visit: the page shows CleanMateX.
 * @module features/auth/ui/login-brand
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { LastBrand } from '@/lib/theme/last-brand'

const LoginBrandContext = createContext<LastBrand | null>(null)

/**
 * Provides the login brand to the login page.
 * @param props - brand (null = CleanMateX) and children
 * @returns The provider
 */
export function LoginBrandProvider({ brand, children }: { brand: LastBrand | null; children: ReactNode }) {
  return <LoginBrandContext.Provider value={brand}>{children}</LoginBrandContext.Provider>
}

/** @returns The last-used Organization's brand, or null for CleanMateX */
export function useLoginBrand(): LastBrand | null {
  return useContext(LoginBrandContext)
}
