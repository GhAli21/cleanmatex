import type { QueryClient } from '@tanstack/react-query'

/**
 * Canonical TanStack Query keys for tenant-level feature flags.
 * Always use this factory for useQuery, invalidateQueries, and removeQueries.
 */
export const featureFlagKeys = {
  all: ['feature-flags'] as const,
  tenant: (tenantId: string) => ['feature-flags', tenantId] as const,
}

/**
 * Invalidate cached flags after a mutation that changes effective tenant flags.
 * @param queryClient - App QueryClient
 * @param tenantId - Tenant whose flags changed; omit to invalidate every tenant key
 */
export function invalidateTenantFeatureFlags(
  queryClient: QueryClient,
  tenantId?: string | null
): Promise<void> {
  if (tenantId) {
    return queryClient.invalidateQueries({ queryKey: featureFlagKeys.tenant(tenantId) })
  }
  return queryClient.invalidateQueries({ queryKey: featureFlagKeys.all })
}

/**
 * Drop all feature-flag queries so a later session cannot read a prior tenant's map.
 * @param queryClient - App QueryClient
 */
export function removeAllFeatureFlagQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: featureFlagKeys.all })
}
