'use client'

/**
 * TanStack Query hooks for Setup Health. Keys include the tenant so switching
 * organization never shows another organization's results. Both refetch on
 * window focus, so returning from a fix screen shows the new state; fix
 * screens may also call invalidateQueries({ queryKey: SETUP_HEALTH_QUERY_ROOT }).
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/auth-context'
import { fetchSetupHealth, fetchSetupHealthSummary } from '../api/setup-health-api'

export const SETUP_HEALTH_QUERY_ROOT = ['setup-health'] as const

/** Full check list for the Setup Health screen; scoped to the current tenant. */
export function useSetupHealth() {
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.tenant_id
  return useQuery({
    queryKey: [...SETUP_HEALTH_QUERY_ROOT, 'list', tenantId],
    queryFn: ({ signal }) => fetchSetupHealth(signal),
    enabled: !!tenantId, // Prevent query before tenant is confirmed
    refetchOnWindowFocus: true,
  })
}

/** Light summary for the layout banner and home card; scoped to the current tenant. */
export function useSetupHealthSummary() {
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.tenant_id
  return useQuery({
    queryKey: [...SETUP_HEALTH_QUERY_ROOT, 'summary', tenantId],
    queryFn: ({ signal }) => fetchSetupHealthSummary(signal),
    enabled: !!tenantId, // Prevent query before tenant is confirmed
    staleTime: 60_000, // setup changes rarely; focus refetch still catches fixes
    refetchOnWindowFocus: true,
  })
}
