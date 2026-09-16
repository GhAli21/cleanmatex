/**
 * Single client implementation of GET /api/feature-flags.
 * Flags are tenant-level (resolved server-side from the active tenant session).
 */
export async function fetchTenantFeatureFlags(): Promise<Record<string, boolean>> {
  const response = await fetch('/api/feature-flags')
  if (!response.ok) {
    throw new Error('Failed to fetch feature flags')
  }
  return (await response.json()) as Record<string, boolean>
}
