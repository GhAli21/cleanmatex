'use client'

/** TanStack Query hooks for tax setup. Keys carry the tenant, so switching organization never shows another's data. */
import { useCallback } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { cmxMessage } from '@ui/feedback'
import { TaxApiError, taxApi, type TaxListParams } from '../api/tax-api'

const ROOT = ['tax'] as const

function useTenantKey() {
  const { currentTenant } = useAuth()
  return currentTenant?.tenant_id
}

/** @returns The organization's tax setup. */
export function useTaxConfig() {
  const tenantId = useTenantKey()
  return useQuery({
    queryKey: [...ROOT, tenantId, 'config'],
    queryFn: ({ signal }) => taxApi.config(signal),
    enabled: !!tenantId, // Prevent query before tenant is confirmed
  })
}

/** @returns Lookups for the tax forms. */
export function useTaxOptions() {
  const tenantId = useTenantKey()
  return useQuery({ queryKey: [...ROOT, tenantId, 'options'], queryFn: ({ signal }) => taxApi.options(signal), enabled: !!tenantId })
}

/** @returns Starter packages for this organization's country. */
export function useTaxPackages() {
  const tenantId = useTenantKey()
  return useQuery({ queryKey: [...ROOT, tenantId, 'packages'], queryFn: ({ signal }) => taxApi.packages(signal), enabled: !!tenantId })
}

/**
 * @param params - Page and filters
 * @returns One page of tax codes
 */
export function useTaxCodes(params: TaxListParams) {
  const tenantId = useTenantKey()
  return useQuery({
    queryKey: [...ROOT, tenantId, 'codes', params],
    queryFn: ({ signal }) => taxApi.codes(params, signal),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  })
}

/**
 * @param params - Page and filters
 * @returns One page of tax rules
 */
export function useTaxRules(params: TaxListParams) {
  const tenantId = useTenantKey()
  return useQuery({
    queryKey: [...ROOT, tenantId, 'rules', params],
    queryFn: ({ signal }) => taxApi.rules(params, signal),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  })
}

/**
 * @param includeInactive - Also return deactivated classes
 * @returns Item tax classes
 */
export function useTaxClasses(includeInactive: boolean) {
  const tenantId = useTenantKey()
  return useQuery({
    queryKey: [...ROOT, tenantId, 'classes', includeInactive],
    queryFn: ({ signal }) => taxApi.classes(includeInactive, signal),
    enabled: !!tenantId,
  })
}

/** @returns A function that turns a failed tax request into translated text. */
export function useTaxErrorText() {
  const t = useTranslations('taxSetup.errors')
  return useCallback(
    (e: unknown) => {
      const key = e instanceof TaxApiError ? e.code : 'TAX_REQUEST_FAILED'
      return t.has(key) ? t(key) : t('TAX_REQUEST_FAILED')
    },
    [t],
  )
}

/**
 * A tax change that refreshes every tax query and shows server errors.
 * @param fn - The API call
 * @param onDone - Runs after success with the result
 * @returns The mutation
 */
export function useTaxMutation<V, R>(fn: (v: V) => Promise<R>, onDone?: (r: R) => void) {
  const qc = useQueryClient()
  const errorText = useTaxErrorText()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ROOT })
      onDone?.(r)
    },
    onError: (e) => cmxMessage.error(errorText(e)),
  })
}
