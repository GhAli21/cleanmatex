/**
 * use-category-products Hook
 * Category/product data fetching with React Query
 */

'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNewOrderDispatch } from '../ui/context/new-order-context';
import type { ServiceCategory, Product } from '../model/new-order-types';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

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
 * Fetch products for a category
 */
async function fetchProducts(
    category: string
): Promise<Product[]> {
    const res = await fetch(
        `/api/v1/products?category=${category}&status=active&limit=${ORDER_DEFAULTS.LIMITS.PRODUCTS_PER_CATEGORY}`
    );
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.success && json.data) {
        return json.data;
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
 * Hook to fetch products for selected category
 */
export function useProducts(category: string | null) {
    const dispatch = useNewOrderDispatch();

    const query = useQuery<Product[]>({
        queryKey: ['products', category],
        queryFn: () => fetchProducts(category!),
        enabled: !!category,
        retry: ORDER_DEFAULTS.RETRY.COUNT,
        retryDelay: (attemptIndex) => ORDER_DEFAULTS.RETRY.DELAYS[attemptIndex] || 2000,
        staleTime: ORDER_DEFAULTS.CACHE.PRODUCTS_STALE_TIME,
    });

    useEffect(() => {
        if (query.data) {
            dispatch({ type: 'SET_PRODUCTS', payload: query.data });
        }
    }, [dispatch, query.data]);

    useEffect(() => {
        dispatch({ type: 'SET_PRODUCTS_LOADING', payload: query.isLoading });
    }, [dispatch, query.isLoading]);

    useEffect(() => {
        if (!category) {
            dispatch({ type: 'SET_PRODUCTS', payload: [] });
            dispatch({ type: 'SET_PRODUCTS_LOADING', payload: false });
        }
    }, [dispatch, category]);

    return query;
}

