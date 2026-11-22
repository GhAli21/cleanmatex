/**
 * Resolves the active Organization's configured default phone country (ISO-2)
 * from tenant settings (`DEFAULT_PHONE_COUNTRY_CODE`), cached via React Query.
 *
 * @module lib/hooks/use-tenant-default-country
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/auth-context'
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code'
import { dialCodeToDefaultCountry, type CountryCode } from '@/lib/phone/phone-utils'

export function useTenantDefaultCountry(explicitTenantId?: string): {
  country: CountryCode | undefined
  dialCode: string | undefined
  isLoading: boolean
} {
  const { currentTenant } = useAuth()
  const tenantId = explicitTenantId || currentTenant?.tenant_id

  const { data: dialCode, isLoading } = useQuery<string>({
    queryKey: ['tenant-phone-country-code', tenantId ?? null],
    queryFn: async () => {
      if (!tenantId) return ''
      return getPhoneCountryCodeAction(tenantId)
    },
    enabled: Boolean(tenantId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  return {
    country: dialCodeToDefaultCountry(dialCode),
    dialCode: dialCode || undefined,
    isLoading,
  }
}
