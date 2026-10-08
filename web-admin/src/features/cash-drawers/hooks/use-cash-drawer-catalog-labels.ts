'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { resolveCatalogLabel } from '@/lib/utils/catalog-label';
import { fetchCashDrawerCatalogs } from '@features/cash-drawers/api/cash-drawer-api';

/** Shared with the close wizard, disposition fields, follow-up and transaction dialog (one fetch, one cache). */
export const CASH_DRAWER_CATALOGS_QUERY_KEY = ['cash-drawers', 'catalogs'] as const;
/** Names change rarely (HQ edits); keep them for the session and refetch in the background. */
const STALE_MS = 10 * 60 * 1000;

export interface CashDrawerCatalogLabels {
  /** Label for a drawer type code (`COUNTER`, `SAFE`, `IN_TRANSIT`, …). */
  drawerType: (code: string | null | undefined) => string;
  /** Label for a custody transaction type code (`CASH_DROP`, `TRANSIT_SEND`, …). */
  trxType: (code: string | null | undefined) => string;
  /** Label for a close disposition code. */
  disposition: (code: string | null | undefined) => string;
  /** Label for a post-close follow-up status code. */
  postClose: (code: string | null | undefined) => string;
  isLoading: boolean;
}

/**
 * Bilingual labels for the cash-drawer code catalogs, resolved from the platform catalogs (so HQ
 * name edits show up everywhere) with the raw code as the fallback while loading or on failure.
 * Screens that only need to *show* a code use this instead of a hand-maintained i18n table that
 * silently misses every code added later.
 */
export function useCashDrawerCatalogLabels(): CashDrawerCatalogLabels {
  const locale = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: CASH_DRAWER_CATALOGS_QUERY_KEY,
    queryFn: fetchCashDrawerCatalogs,
    staleTime: STALE_MS,
    retry: 1,
  });

  const drawerType = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.drawerTypes, code, locale),
    [data, locale],
  );
  const trxType = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.trxTypes, code, locale),
    [data, locale],
  );
  const disposition = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.dispositions, code, locale),
    [data, locale],
  );
  const postClose = useCallback(
    (code: string | null | undefined) => resolveCatalogLabel(data?.postCloseStatuses, code, locale),
    [data, locale],
  );

  return { drawerType, trxType, disposition, postClose, isLoading };
}
