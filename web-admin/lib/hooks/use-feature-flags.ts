'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/auth-context'
import { fetchTenantFeatureFlags } from '@/lib/api/feature-flags-client'
import { featureFlagKeys } from '@/lib/query/feature-flag-keys'
import type { FeatureFlagKey } from '@/lib/services/feature-flags.service'

/** Client flags stay fresh for 5 minutes; mutations must invalidate explicitly. */
export const FEATURE_FLAG_STALE_TIME_MS = 5 * 60 * 1000

interface UseFeatureFlagsQueryOptions {
  /** When false, this observer does not start a network request. */
  enabled?: boolean
}

/**
 * Shared tenant-level feature-flag query.
 * Query key is tenant-scoped so Tenant A data never renders for Tenant B.
 * @param options.enabled - Extra gate (e.g. inspector closed, no flag requested)
 * @returns TanStack Query result for the active tenant's flag map
 */
export function useFeatureFlagsQuery(options: UseFeatureFlagsQueryOptions = {}) {
  const { currentTenant, isTenantContextReady } = useAuth()
  const tenantId = currentTenant?.tenant_id
  const enabled =
    Boolean(tenantId) && isTenantContextReady && (options.enabled ?? true)

  return useQuery({
    queryKey: featureFlagKeys.tenant(tenantId ?? ''),
    queryFn: fetchTenantFeatureFlags,
    enabled,
    staleTime: FEATURE_FLAG_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  })
}

/**
 * Check one flag. When `feature` is undefined, returns true without starting a fetch.
 * @param feature - Flag key, or undefined to skip gating
 * @returns Whether the flag is enabled (fail-closed when the query errors)
 */
export function useFeatureOptional(feature: FeatureFlagKey | undefined): boolean {
  const { data: flags, isError } = useFeatureFlagsQuery({
    enabled: Boolean(feature),
  })

  if (!feature) {
    return true
  }
  if (isError || !flags) {
    return false
  }
  return flags[feature] === true
}

/**
 * Check one required feature flag against the shared tenant query.
 * @param feature - Flag key
 * @returns Whether the flag is enabled
 */
export function useFeature(feature: FeatureFlagKey): boolean {
  return useFeatureOptional(feature)
}
