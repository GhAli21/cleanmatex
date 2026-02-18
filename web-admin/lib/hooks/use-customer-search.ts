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

export interface UseCustomerSearchOptions {
  search: string;
  searchAllOptions?: boolean;
  limit?: number;
  /** Min chars before triggering search (default 2) */
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
    searchAllOptions = false,
    limit = 10,
    minChars = CUSTOMER_SEARCH_MIN_CHARS,
  } = options;

  const debouncedSearch = useDebounce(search, CUSTOMER_SEARCH_DEBOUNCE_MS);
  const trimmedSearch = debouncedSearch.trim();
  const canSearch = trimmedSearch.length >= minChars;

  const queryKey = useMemo(
    () => ['customers', 'search', trimmedSearch, searchAllOptions, limit],
    [trimmedSearch, searchAllOptions, limit]
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
