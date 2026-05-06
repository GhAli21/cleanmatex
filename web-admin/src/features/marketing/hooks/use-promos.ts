'use client';

/**
 * React hooks for promo code data.
 * Uses server actions directly via useEffect/useState to avoid requiring
 * a separate API layer for this admin-only feature.
 */

import { useState, useEffect, useCallback } from 'react';
import { listPromoCodes, getPromoCodeUsageAction } from '@/app/actions/marketing/promo-actions';
import type { PromoCode, PromoCodeUsage } from '@/lib/types/payment';

interface UsePromoCodesParams {
  search?: string;
  status?: 'all' | 'active' | 'expired';
  page?: number;
}

/**
 * Hook to list and paginate promo codes for the current tenant.
 */
export function usePromoCodes(params: UsePromoCodesParams = {}) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listPromoCodes({
      page: params.page,
      search: params.search,
      status: params.status,
    }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPromoCodes(result.data);
        setTotal(result.total);
        setError(null);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [params.page, params.search, params.status, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { promoCodes, total, isLoading, error, refetch };
}

/**
 * Hook to fetch usage history for a specific promo code.
 */
export function usePromoUsage(promoCodeId: string) {
  const [usage, setUsage] = useState<PromoCodeUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getPromoCodeUsageAction(promoCodeId).then((result) => {
      if (cancelled) return;
      if (result.success) setUsage(result.data);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [promoCodeId]);

  return { usage, isLoading };
}
