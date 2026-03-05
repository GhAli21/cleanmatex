/**
 * useCustomerSearch Hook
 * Fast, debounced customer search for picker/autocomplete.
 * Uses React Query for caching, deduplication, and stale-while-revalidate.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { searchCustomersForPicker, type CustomerSearchItem } from '@/lib/api/customers';

export const CUSTOMER_SEARCH_DEBOUNCE_MS = 250;
export const CUSTOMER_SEARCH_MIN_CHARS = 2;

export const CUSTOMER_SEARCH_MIN_PHONE = 3;
export const CUSTOMER_SEARCH_MIN_EMAIL = 3;

export interface UseCustomerSearchOptions {
  search: string;
  searchPhone?: string;
  searchName?: string;
  searchEmail?: string;
  searchAllOptions?: boolean;
  limit?: number;
  /** Min chars for general search (default 2) */
  minChars?: number;
}

export interface UseCustomerSearchResult {
  customers: CustomerSearchItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  isReady: boolean; // true when search has enough chars and we have a result (or empty)
}

/**
 * Debounced customer search with React Query.
 * - 250ms debounce for reduced API calls
 * - Caches results per query key
 * - Stale-while-revalidate: shows previous results while refetching
 */
export function useCustomerSearch(options: UseCustomerSearchOptions): UseCustomerSearchResult {
  const {
    search,
    searchPhone = '',
    searchName = '',
    searchEmail = '',
    searchAllOptions = false,
    limit = 10,
    minChars = CUSTOMER_SEARCH_MIN_CHARS,
  } = options;

  const debouncedSearch = useDebounce(search, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const debouncedPhone = useDebounce(searchPhone, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const debouncedName = useDebounce(searchName, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const debouncedEmail = useDebounce(searchEmail, CUSTOMER_SEARCH_DEBOUNCE_MS);

  const trimmedSearch = debouncedSearch.trim();
  const trimmedPhone = debouncedPhone.trim();
  const trimmedName = debouncedName.trim();
  const trimmedEmail = debouncedEmail.trim();

  const hasFieldSearch =
    trimmedPhone.length >= CUSTOMER_SEARCH_MIN_PHONE ||
    trimmedName.length >= minChars ||
    trimmedEmail.length >= CUSTOMER_SEARCH_MIN_EMAIL;
  const canSearch = trimmedSearch.length >= minChars || hasFieldSearch;

  const queryKey = useMemo(
    () => ['customers', 'search', trimmedSearch, trimmedPhone, trimmedName, trimmedEmail, searchAllOptions, limit],
    [trimmedSearch, trimmedPhone, trimmedName, trimmedEmail, searchAllOptions, limit]
  );

  const {
    data: customers = [],
    isLoading,
    isFetching,
    error,
    isFetched,
  } = useQuery({
    queryKey,
    queryFn: () =>
      searchCustomersForPicker({
        search: trimmedSearch,
        searchPhone: trimmedPhone || undefined,
        searchName: trimmedName || undefined,
        searchEmail: trimmedEmail || undefined,
        searchAllOptions,
        limit,
      }),
    enabled: canSearch,
    staleTime: 30_000, // 30s - same search within 30s uses cache
    gcTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  return {
    customers,
    isLoading: canSearch && isLoading,
    isFetching: canSearch && isFetching,
    error: error instanceof Error ? error : null,
    isReady: !canSearch || isFetched,
  };
}
