'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { CartQuoteData } from '@/lib/types/cart-quote';
import type { CartQuoteRequest } from '@/lib/validations/new-order-payment-schemas';
import { CartQuoteError, fetchCartQuote } from '../api/cart-quote-api';
import { serializePaymentQuoteInput } from './use-payment-quote';

/** Inputs of the New Order cart quote. */
export interface UseCartQuoteParams {
  /** False in Order Edit: an edit is quoted by its own preview, never as a new order. */
  enabled: boolean;
  tenantOrgId: string | undefined;
  request: Omit<CartQuoteRequest, 'requestId'>;
  csrfReady: boolean;
  csrfToken: string | null | undefined;
}

/** Same debounce as the payment quote: one request per pause in typing. */
const CART_QUOTE_DEBOUNCE_MS = 300;

/**
 * Keeps the server's figures for the current cart (Line-Level P5-03, BF-19).
 * Figures are never computed here; while a new cart is being priced the last
 * figures stay on screen marked as updating, never as final.
 * @returns `data` (the last answer), `current` (it matches the cart on screen), `pending`, `failed`, `errorCode`, `refetch`
 * @example const quote = useCartQuote({ enabled: !isEditMode, tenantOrgId, request, csrfReady, csrfToken });
 */
export function useCartQuote({ enabled, tenantOrgId, request, csrfReady, csrfToken }: UseCartQuoteParams) {
  const signature = serializePaymentQuoteInput(request as Parameters<typeof serializePaymentQuoteInput>[0]);
  const debounced = useDebounce(signature, CART_QUOTE_DEBOUNCE_MS);
  const hasItems = request.items.length > 0;

  const query = useQuery<CartQuoteData, Error>({
    // Tenant in the key: a tenant switch never shows another organization's figures.
    queryKey: ['order-cart-quote', tenantOrgId, debounced],
    queryFn: ({ signal }) =>
      fetchCartQuote({ ...(JSON.parse(debounced) as Omit<CartQuoteRequest, 'requestId'>), requestId: crypto.randomUUID() }, csrfToken, signal),
    // Prevent any request before the tenant and CSRF token are confirmed.
    enabled: enabled && !!tenantOrgId && csrfReady && hasItems && debounced === signature,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const settled = debounced === signature && !query.isFetching && !query.isPlaceholderData;
  return {
    data: enabled && hasItems ? query.data ?? null : null,
    /** The figures belong to the cart on screen. */
    current: enabled && hasItems && settled && !!query.data && !query.isError,
    pending: enabled && hasItems && !settled && !query.isError,
    failed: enabled && hasItems && query.isError && debounced === signature,
    errorCode: query.error instanceof CartQuoteError ? query.error.code : query.isError ? 'CART_QUOTE_UNAVAILABLE' : null,
    refetch: query.refetch,
  };
}
