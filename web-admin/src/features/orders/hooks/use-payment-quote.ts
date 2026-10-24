'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PreviewPaymentRequest } from '@/lib/validations/new-order-payment-schemas';
import type { PaymentQuoteData } from '@/lib/types/payment-quote';
import { fetchOrderPaymentQuote, PaymentQuoteError } from '../api/payment-quote-api';

/** Identity and financial inputs for one open payment session. */
export interface UsePaymentQuoteParams {
  open: boolean;
  sessionKey: string;
  tenantOrgId: string;
  userId?: string;
  request: PreviewPaymentRequest;
  csrfReady: boolean;
  csrfToken: string | null | undefined;
}

/**
 * Canonicalizes JSON object keys so shell and engine share equivalent inputs;
 * item and preference array order remains significant to the calculation.
 * @param request - Quote body before correlation metadata is added.
 * @returns Stable financial-input identity, independent of object insertion order.
 */
export function serializePaymentQuoteInput(request: PreviewPaymentRequest): string {
  return JSON.stringify(request, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
      : value);
}

/**
 * Requires a fresh review when either inputs or the authoritative response changes.
 * @param reviewedAuthority - Quote captured when the cashier opened confirmation.
 * @param currentAuthority - Current session/revision/response identity.
 * @param ready - Whether current inputs have a complete usable quote.
 * @returns Whether submitting the reviewed snapshot is still permitted.
 */
export function isPaymentQuoteReviewCurrent(reviewedAuthority: string | null, currentAuthority: string | null, ready: boolean): boolean {
  return ready && reviewedAuthority !== null && reviewedAuthority === currentAuthority;
}

/**
 * Shares the opening quote between shell and engine, then atomically refreshes
 * totals and amount eligibility. Every changed input gets a new revision, so
 * reverting a discount cannot revive an earlier cached financial authority.
 * Tenant, cashier, branch, customer, and open-session identity isolate results.
 * @param params - Session identity, current financial inputs, and CSRF readiness.
 * @returns Latest confirmed snapshot plus immediate stale-input locking and Retry.
 * @example usePaymentQuote({ open, sessionKey, tenantOrgId, userId, request, csrfReady, csrfToken });
 */
export function usePaymentQuote({ open, sessionKey, tenantOrgId, userId, request, csrfReady, csrfToken }: UsePaymentQuoteParams) {
  const scope = JSON.stringify([tenantOrgId, userId ?? '', request.branchId ?? '', request.customerId ?? '', sessionKey]);
  const signature = serializePaymentQuoteInput(request);
  const [input, setInput] = useState({ scope, signature, revision: 0 });
  const current = input.scope === scope && input.signature === signature
    ? input
    : { scope, signature, revision: input.scope === scope ? input.revision + 1 : 0 };
  if (current !== input) setInput(current);
  const [debounced, setDebounced] = useState(current);
  const [confirmed, setConfirmed] = useState<{ scope: string; data: PaymentQuoteData } | null>(null);
  const initial = current.revision === 0;
  const debouncePending = !initial && (debounced.scope !== scope || debounced.signature !== signature || debounced.revision !== current.revision);
  useEffect(() => {
    if (!debouncePending) return;
    // Initial open is immediate; later financial edits retain the existing 300ms debounce.
    const timer = setTimeout(() => setDebounced(current), 300);
    return () => clearTimeout(timer);
  }, [current, debouncePending]);

  const query = useQuery<PaymentQuoteData, Error>({
    queryKey: ['order-payment-quote', scope, current.revision, signature],
    queryFn: async ({ signal }) => {
      const data = await fetchOrderPaymentQuote({ ...request, requestId: crypto.randomUUID() }, csrfToken, signal);
      // An administrator changing currency rules must not relabel typed money
      // or apply a new precision underneath the form's existing currency config.
      if (confirmed?.scope === scope && (confirmed.data.currencyCode !== data.currencyCode ||
        confirmed.data.decimalPlaces !== data.decimalPlaces || confirmed.data.currencyExRate !== data.currencyExRate)) {
        throw new PaymentQuoteError('PAYMENT_CURRENCY_CHANGED');
      }
      return data;
    },
    // Prevent any request before authenticated tenant and CSRF resolution are confirmed.
    enabled: open && !!tenantOrgId && !!userId && csrfReady && request.items.length > 0 && !debouncePending,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Open-session quotes are disposable; a reopen always uses a new session identity.
    gcTime: 0,
  });
  if (query.data && (confirmed?.scope !== scope || confirmed.data !== query.data)) {
    setConfirmed({ scope, data: query.data });
  }
  const snapshot = query.data ?? (confirmed?.scope === scope ? confirmed.data : null);
  const contextMissing = open && (!tenantOrgId || !userId);
  const pending = !contextMissing && open && (debouncePending || query.isFetching || !query.data) && !query.isError;
  return {
    snapshot,
    authorityKey: query.data ? JSON.stringify([scope, current.revision, query.data.requestId]) : null,
    ready: !contextMissing && open && !debouncePending && !query.isFetching && !!query.data && !query.isError,
    pending,
    failed: contextMissing || query.isError,
    errorCode: contextMissing ? 'PAYMENT_CONTEXT_UNAVAILABLE' : query.error instanceof PaymentQuoteError ? query.error.code : query.isError ? 'PAYMENT_QUOTE_UNAVAILABLE' : null,
    refetch: query.refetch,
  };
}
