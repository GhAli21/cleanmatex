'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import { resolveCatalogLabel } from '@/lib/utils/catalog-label';
import type { SessionLifecycleCatalogs } from '@/lib/types/session-lifecycle-catalogs';

const QUERY_KEY = ['session-lifecycle-catalogs'] as const;
/** Names change rarely (HQ edits); keep them for the session and refetch in the background. */
const STALE_MS = 10 * 60 * 1000;

async function fetchSessionLifecycleCatalogs(): Promise<SessionLifecycleCatalogs> {
  const response = await fetch('/api/v1/pos-sessions/catalogs', { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: SessionLifecycleCatalogs;
    error?: string;
  };
  if (!response.ok || payload.success === false || !payload.data) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload.data;
}

export interface SessionLifecycleLabels {
  /** Label for a POS-session status code (`OPEN`, `PAUSED`, …). */
  posStatus: (code: string | null | undefined) => string;
  /** Label for a POS-session audit event code (`ROLLOVER_PAUSE`, …). */
  posEvent: (code: string | null | undefined) => string;
  /** Label for a cash-drawer-session status code (`OPEN`, `CLOSING`, …). */
  drawerStatus: (code: string | null | undefined) => string;
  /** Filter options for the POS-session status select, in catalog order. */
  posStatusOptions: Array<{ value: string; label: string }>;
  isLoading: boolean;
}

/**
 * Bilingual labels for session-lifecycle codes, resolved from the platform catalogs (so HQ name
 * edits show up) with the raw code as the fallback while loading or if the catalog call fails —
 * a screen never renders blank or breaks because labels are unavailable.
 */
export function useSessionLifecycleLabels(): SessionLifecycleLabels {
  const locale = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSessionLifecycleCatalogs,
    staleTime: STALE_MS,
    retry: 1,
  });

  const posStatus = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.posSessionStatuses, code, locale),
    [data, locale],
  );
  const posEvent = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.posSessionEventTypes, code, locale),
    [data, locale],
  );
  const drawerStatus = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.drawerSessionStatuses, code, locale),
    [data, locale],
  );

  const posStatusOptions = useMemo(() => {
    const rows = data?.posSessionStatuses;
    // Until the catalog arrives (or if it fails), offer the stable code set so the filter is never empty.
    if (!rows) return Object.values(POS_SESSION_STATUS).map((code) => ({ value: code, label: code }));
    return rows
      .filter((r) => r.isActive)
      .map((r) => ({ value: r.code, label: resolveCatalogLabel(rows, r.code, locale) }));
  }, [data, locale]);

  return { posStatus, posEvent, drawerStatus, posStatusOptions, isLoading };
}
