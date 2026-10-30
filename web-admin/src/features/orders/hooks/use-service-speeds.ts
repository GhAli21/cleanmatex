'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import type { ServiceSpeedLookupRow } from '@/lib/services/lookups/service-speed-lookup.service';

/** Speeds change only when HQ edits the catalog; one read per session is enough. */
const SPEEDS_STALE_MS = 30 * 60 * 1000;

async function fetchServiceSpeeds(signal: AbortSignal): Promise<ServiceSpeedLookupRow[]> {
  const response = await fetch('/api/v1/lookups/service-speeds', { signal });
  const result = await response.json().catch(() => null) as { success?: boolean; data?: ServiceSpeedLookupRow[] } | null;
  if (!response.ok || !result?.success || !Array.isArray(result.data)) throw new Error('SERVICE_SPEEDS_UNAVAILABLE');
  return result.data;
}

/**
 * The active service speeds (`sys_service_speed_cd`) for the speed menus
 * (Line-Level P5-03b, PLAN §5.4). An HQ catalog: the same for every
 * organization, so it is not keyed by tenant.
 * @returns `speeds` in display order, `labelOf(code)` in the screen language, loading and error flags
 * @example const { speeds, labelOf } = useServiceSpeeds(); labelOf('EXPRESS'); // "Express" / "سريع"
 */
export function useServiceSpeeds() {
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['lookups', 'service-speeds'],
    queryFn: ({ signal }) => fetchServiceSpeeds(signal),
    staleTime: SPEEDS_STALE_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const speeds = query.data ?? [];
  const labelOf = useCallback(
    (code: string) => {
      const row = (query.data ?? []).find((s) => s.code === code);
      if (!row) return code;
      return locale === 'ar' ? row.name2 || row.name : row.name;
    },
    [query.data, locale],
  );
  return { speeds, labelOf, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}
