'use client';

import { useQueries } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import type { CartQuoteRequest } from '@/lib/validations/new-order-payment-schemas';
import { CartQuoteError, fetchCartQuote } from '../api/cart-quote-api';

/** How a speed menu prices its options. */
export interface SpeedOptionPreviewSource {
  /** The cart as it would be at this speed; null when there is nothing to price. */
  requestFor: (serviceSpeed: string) => Omit<CartQuoteRequest, 'requestId'> | null;
  /** Set on a line menu: show that line's total, not the order's. */
  lineIndex?: number;
}

/** What one menu option shows: server figures only, nothing computed here. */
export interface SpeedOptionPreview {
  /** The total at this speed, formatted; null while loading. */
  total: string | null;
  /** The promised ready time, formatted. */
  ready: string | null;
  /** A line in the cart has no rule for this speed. */
  notOffered: boolean;
}

/**
 * Quotes the cart once per speed, only while the menu is open (at most one
 * request per offered speed; answers are cached for 30 seconds).
 * @param codes - the speeds in the menu
 * @param source - how to build each request; absent in Order Edit
 * @param open - whether the menu is open
 * @returns the preview per speed code; a speed still loading or failing for another reason has no figures
 */
export function useSpeedOptionPreviews(
  codes: readonly string[],
  source: SpeedOptionPreviewSource | undefined,
  open: boolean,
): ReadonlyMap<string, SpeedOptionPreview> {
  const locale = useLocale();
  const tenantId = useAuth().currentTenant?.tenant_id;
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();

  const results = useQueries({
    queries: codes.map((code) => {
      const request = source?.requestFor(code) ?? null;
      return {
        queryKey: ['speed-option-preview', tenantId, code, request],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchCartQuote({ ...(request as NonNullable<typeof request>), requestId: crypto.randomUUID() }, csrfToken, signal),
        enabled: open && !!tenantId && !csrfLoading && !!request && request.items.length > 0,
        retry: false,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      };
    }),
  });

  const previews = new Map<string, SpeedOptionPreview>();
  codes.forEach((code, i) => {
    const { data, error } = results[i];
    const notOffered = error instanceof CartQuoteError && error.code === 'SPEED_NOT_OFFERED';
    if (!data) {
      previews.set(code, { total: null, ready: null, notOffered });
      return;
    }
    const line = source?.lineIndex === undefined ? null : data.lines.find((l) => l.index === source.lineIndex);
    const amount = line ? line.lineTotalAmount : data.totals.saleTotal;
    const readyAt = line ? line.readyByAt : data.readyByAt;
    previews.set(code, {
      total: new Intl.NumberFormat(locale, {
        style: 'currency', currency: data.currencyCode, minimumFractionDigits: data.decimalPlaces, maximumFractionDigits: data.decimalPlaces,
      }).format(amount),
      ready: new Intl.DateTimeFormat(locale, {
        weekday: 'short', hour: 'numeric', minute: '2-digit', ...(data.timezone ? { timeZone: data.timezone } : {}),
      }).format(new Date(readyAt)),
      notOffered: false,
    });
  });
  return previews;
}
