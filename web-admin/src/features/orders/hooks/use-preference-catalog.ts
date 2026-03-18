/**
 * use-preference-catalog Hook
 * Fetches service and packing preferences from catalog API
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import type { ServicePreference, PackingPreference } from '@/lib/types/service-preferences';

async function fetchServicePreferences(
  tenantId: string,
  branchId?: string | null
): Promise<ServicePreference[]> {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  const res = await fetch(
    `/api/v1/catalog/service-preferences?${params.toString()}`,
    { credentials: 'include' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.success && json.data ? json.data : [];
}

async function fetchPackingPreferences(tenantId: string): Promise<PackingPreference[]> {
  const res = await fetch('/api/v1/catalog/packing-preferences', {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.success && json.data ? json.data : [];
}

export function usePreferenceCatalog(branchId?: string | null) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';

  const servicePrefsQuery = useQuery({
    queryKey: ['preference-catalog', 'service', tenantId, branchId],
    queryFn: () => fetchServicePreferences(tenantId, branchId),
    enabled: !!tenantId,
  });

  const packingPrefsQuery = useQuery({
    queryKey: ['preference-catalog', 'packing', tenantId],
    queryFn: () => fetchPackingPreferences(tenantId),
    enabled: !!tenantId,
  });

  const allPrefs = servicePrefsQuery.data ?? [];

  const conditionCatalog = {
    stains: allPrefs.filter((p) => p.preference_sys_kind === 'condition_stain'),
    damages: allPrefs.filter((p) => p.preference_sys_kind === 'condition_damag'),
    colors: allPrefs.filter((p) => p.preference_sys_kind === 'color'),
  };

  // service prefs only (exclude conditions and colors)
  const servicePrefsOnly = allPrefs.filter(
    (p) => !p.preference_sys_kind || p.preference_sys_kind === 'service_prefs'
  );

  return {
    servicePrefs: servicePrefsOnly,
    packingPrefs: packingPrefsQuery.data ?? [],
    conditionCatalog,
    isLoading: servicePrefsQuery.isLoading || packingPrefsQuery.isLoading,
    hasServicePrefs: servicePrefsOnly.length > 0,
    hasPackingPrefs: (packingPrefsQuery.data?.length ?? 0) > 0,
  };
}
