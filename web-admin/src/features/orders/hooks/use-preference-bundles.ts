/**
 * use-preference-bundles Hook
 * Fetches preference bundles (Care Packages) from catalog API
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import type { PreferenceBundle } from '@/lib/types/service-preferences';

async function fetchPreferenceBundles(tenantId: string): Promise<PreferenceBundle[]> {
  const res = await fetch('/api/v1/catalog/preference-bundles', {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.success && json.data ? json.data : [];
}

export function usePreferenceBundles() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';

  const query = useQuery({
    queryKey: ['preference-bundles', tenantId],
    queryFn: () => fetchPreferenceBundles(tenantId),
    enabled: !!tenantId,
  });

  return {
    bundles: query.data ?? [],
    isLoading: query.isLoading,
    hasBundles: (query.data?.length ?? 0) > 0,
  };
}
