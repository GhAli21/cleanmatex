/**
 * use-category-products Hook
 * Category/product data fetching with React Query
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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

const EMPTY_PRODUCTS: Product[] = [];

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
 * Fetch one page of products (search + pagination; category optional for global search).
 */
async function fetchProductsPage(
  page: number,
  pageSize: number,
  search?: string,
  category?: string
): Promise<ProductsPageResult> {
  const params = new URLSearchParams({
    status: 'active',
    limit: String(pageSize),
    page: String(page),
    sortBy: 'name',
    sortOrder: 'asc',
  });

  if (category) {
    params.set('category', category);
  }

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
 * Hook to fetch products for selected category (search, pagination, optional global search).
 * @param category
 */
export function useProducts(category: string | null) {
  const dispatch = useNewOrderDispatch();
  const [productSearch, setProductSearchState] = useState('');
  const [searchAllCategories, setSearchAllCategoriesState] = useState(false);
  const [pageSize, setPageSizeState] = useState<number>(
    ORDER_DEFAULTS.LIMITS.PRODUCTS_PER_CATEGORY
  );
  const [pagesByFilter, setPagesByFilter] = useState<Record<string, number>>({});

  const debouncedSearch = useDebouncedValue(
    productSearch,
    ORDER_DEFAULTS.DEBOUNCE_MS.SEARCH
  );

  const isGlobalSearch = searchAllCategories && debouncedSearch.trim().length > 0;
  const browseCategory = isGlobalSearch ? undefined : category ?? undefined;

  const filterKey = [
    browseCategory ?? '__all__',
    debouncedSearch,
    searchAllCategories,
    pageSize,
  ].join('|');

  const currentPage = pagesByFilter[filterKey] ?? 1;

  const setCurrentPage = useCallback(
    (page: number) => {
      setPagesByFilter((prev) => ({ ...prev, [filterKey]: page }));
    },
    [filterKey]
  );

  const setProductSearch = useCallback((value: string) => {
    setProductSearchState(value);
  }, []);

  const setSearchAllCategories = useCallback((value: boolean) => {
    setSearchAllCategoriesState(value);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
  }, []);

  const query = useQuery({
    queryKey: [
      'products',
      browseCategory ?? '__all__',
      debouncedSearch,
      searchAllCategories,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      let pageToFetch = currentPage;
      let result = await fetchProductsPage(
        pageToFetch,
        pageSize,
        debouncedSearch,
        browseCategory
      );
      if (pageToFetch > result.totalPages && result.totalPages > 0) {
        pageToFetch = result.totalPages;
        result = await fetchProductsPage(
          pageToFetch,
          pageSize,
          debouncedSearch,
          browseCategory
        );
      }
      return result;
    },
    enabled: !!category,
    retry: ORDER_DEFAULTS.RETRY.COUNT,
    retryDelay: (attemptIndex) => ORDER_DEFAULTS.RETRY.DELAYS[attemptIndex] || 2000,
    staleTime: ORDER_DEFAULTS.CACHE.PRODUCTS_STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const products = query.data?.products ?? EMPTY_PRODUCTS;
  const productsTotal = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const resolvedCurrentPage = query.data?.page ?? currentPage;
  const isSearchPending = productSearch !== debouncedSearch;

  useEffect(() => {
    dispatch({ type: 'SET_PRODUCTS', payload: products });
  }, [dispatch, products]);

  useEffect(() => {
    dispatch({
      type: 'SET_PRODUCTS_LOADING',
      payload: query.isLoading && !query.data,
    });
  }, [dispatch, query.isLoading, query.data]);

  useEffect(() => {
    if (!category) {
      dispatch({ type: 'SET_PRODUCTS', payload: [] });
      dispatch({ type: 'SET_PRODUCTS_LOADING', payload: false });
    }
  }, [dispatch, category]);

  return {
    productSearch,
    setProductSearch,
    searchAllCategories,
    setSearchAllCategories,
    isGlobalSearch,
    products,
    productsTotal,
    totalPages,
    currentPage: resolvedCurrentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    isFetching: query.isFetching,
    isSearchPending,
    isError: query.isError,
    error: query.error,
    isInitialLoading: query.isLoading && !query.data,
  };
}
