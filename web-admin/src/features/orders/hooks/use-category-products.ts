/**
 * use-category-products Hook
 * Category/product data fetching with React Query
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNewOrderDispatch } from '../ui/context/new-order-context';
import type { ServiceCategory, Product } from '../model/new-order-types';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

interface ProductsPageResult {
  products: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Fetch categories
 */
async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/v1/categories?enabled=true');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  if (json.success && json.data) {
    return json.data;
  }
  throw new Error(json.error || 'Failed to load categories');
}

/**
 * Fetch one page of products for a category (search + pagination).
 */
async function fetchProductsPage(
  category: string,
  page: number,
  search?: string
): Promise<ProductsPageResult> {
  const params = new URLSearchParams({
    category,
    status: 'active',
    limit: String(ORDER_DEFAULTS.LIMITS.PRODUCTS_PER_CATEGORY),
    page: String(page),
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    params.set('search', trimmedSearch);
    params.set('searchScope', 'name');
  }

  const res = await fetch(`/api/v1/products?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  if (json.success && json.data) {
    return {
      products: json.data as Product[],
      page: json.pagination.page,
      limit: json.pagination.limit,
      total: json.pagination.total,
      totalPages: json.pagination.totalPages,
    };
  }
  throw new Error(json.error || 'Failed to load products');
}

/**
 * Hook to fetch categories
 */
export function useCategories() {
  const dispatch = useNewOrderDispatch();

  const query = useQuery<ServiceCategory[]>({
    queryKey: ['categories', 'enabled'],
    queryFn: fetchCategories,
    retry: ORDER_DEFAULTS.RETRY.COUNT,
    retryDelay: (attemptIndex) => ORDER_DEFAULTS.RETRY.DELAYS[attemptIndex] || 2000,
    staleTime: ORDER_DEFAULTS.CACHE.CATEGORIES_STALE_TIME,
  });

  useEffect(() => {
    if (query.data) {
      dispatch({ type: 'SET_CATEGORIES', payload: query.data });
    }
  }, [dispatch, query.data]);

  useEffect(() => {
    dispatch({ type: 'SET_CATEGORIES_LOADING', payload: query.isLoading });
  }, [dispatch, query.isLoading]);

  return query;
}

/**
 * Hook to fetch products for selected category (search + load more).
 * @param category
 */
export function useProducts(category: string | null) {
  const dispatch = useNewOrderDispatch();
  const [searchByCategory, setSearchByCategory] = useState<Record<string, string>>({});

  const productSearch = category ? (searchByCategory[category] ?? '') : '';
  const debouncedSearch = useDebouncedValue(
    productSearch,
    ORDER_DEFAULTS.DEBOUNCE_MS.SEARCH
  );

  const setProductSearch = useCallback(
    (value: string) => {
      if (!category) {
        return;
      }
      setSearchByCategory((prev) => ({ ...prev, [category]: value }));
    },
    [category]
  );

  const query = useInfiniteQuery({
    queryKey: ['products', category, debouncedSearch],
    queryFn: ({ pageParam }) =>
      fetchProductsPage(category!, pageParam, debouncedSearch),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: !!category,
    retry: ORDER_DEFAULTS.RETRY.COUNT,
    retryDelay: (attemptIndex) => ORDER_DEFAULTS.RETRY.DELAYS[attemptIndex] || 2000,
    staleTime: ORDER_DEFAULTS.CACHE.PRODUCTS_STALE_TIME,
  });

  const flattenedProducts = useMemo(
    () => query.data?.pages.flatMap((page) => page.products) ?? [],
    [query.data?.pages]
  );
  const productsTotal = query.data?.pages[0]?.total ?? 0;
  const isSearchPending = productSearch !== debouncedSearch;

  useEffect(() => {
    dispatch({ type: 'SET_PRODUCTS', payload: flattenedProducts });
  }, [dispatch, flattenedProducts]);

  useEffect(() => {
    dispatch({
      type: 'SET_PRODUCTS_LOADING',
      payload: query.isLoading || (query.isFetching && !query.isFetchingNextPage),
    });
  }, [dispatch, query.isLoading, query.isFetching, query.isFetchingNextPage]);

  useEffect(() => {
    if (!category) {
      dispatch({ type: 'SET_PRODUCTS', payload: [] });
      dispatch({ type: 'SET_PRODUCTS_LOADING', payload: false });
    }
  }, [dispatch, category]);

  return {
    ...query,
    productSearch,
    setProductSearch,
    productsTotal,
    loadedCount: flattenedProducts.length,
    isSearchPending,
  };
}
