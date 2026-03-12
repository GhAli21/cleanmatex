/**
 * usePlanFlags Hook
 * Fetches plan-bound feature flags (bundles, repeat last order, smart suggestions) for the new order UI
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import type { PlanFlags } from '@/lib/constants/plan-flags';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

async function fetchPlanFlags(): Promise<PlanFlags> {
  const res = await fetch('/api/v1/plan-flags', { credentials: 'include' });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Unauthorized' : res.status === 403 ? 'No tenant access' : 'Failed to fetch plan flags');
  }
  const json = await res.json();
  return {
    bundlesEnabled: Boolean(json.bundlesEnabled),
    repeatLastOrderEnabled: Boolean(json.repeatLastOrderEnabled),
    smartSuggestionsEnabled: Boolean(json.smartSuggestionsEnabled),
  };
}

export function usePlanFlags() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';

  const query = useQuery({
    queryKey: ['plan-flags', tenantId],
    queryFn: fetchPlanFlags,
    enabled: !!tenantId,
    staleTime: STALE_TIME,
  });

  return {
    bundlesEnabled: query.data?.bundlesEnabled ?? false,
    repeatLastOrderEnabled: query.data?.repeatLastOrderEnabled ?? false,
    smartSuggestionsEnabled: query.data?.smartSuggestionsEnabled ?? false,
    isLoading: query.isLoading,
    error: query.error,
  };
}
