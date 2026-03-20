/**
 * use-preference-catalog Hook
 * Fetches service preferences, packing preferences, and preference kinds from catalog API
 */

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import type { ServicePreference, PackingPreference, PreferenceKind } from '@/lib/types/service-preferences';

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

async function fetchPreferenceKinds(tenantId: string): Promise<PreferenceKind[]> {
  const res = await fetch('/api/v1/catalog/preference-kinds?quickBarOnly=false', {
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

  const kindsQuery = useQuery<PreferenceKind[]>({
    queryKey: ['preference-kinds', tenantId],
    queryFn: () => fetchPreferenceKinds(tenantId),
    staleTime: 5 * 60 * 1000,
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

  // Map of kind_code → preferences for that kind (used by dynamic panel)
  const prefsByKind = useMemo(() => {
    const map = new Map<string, ServicePreference[]>();
    for (const pref of allPrefs) {
      const key = pref.preference_sys_kind ?? 'service_prefs';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pref);
    }
    return map;
  }, [allPrefs]);

  return {
    servicePrefs: servicePrefsOnly,
    packingPrefs: packingPrefsQuery.data ?? [],
    conditionCatalog,
    isLoading: servicePrefsQuery.isLoading || packingPrefsQuery.isLoading,
    hasServicePrefs: servicePrefsOnly.length > 0,
    hasPackingPrefs: (packingPrefsQuery.data?.length ?? 0) > 0,
    // new — dynamic kinds
    preferenceKinds: kindsQuery.data ?? [],
    kindsLoading: kindsQuery.isLoading,
    prefsByKind,
  };
}
