'use client';

/**
 * React hooks for discount rules data.
 */

import { useState, useEffect, useCallback } from 'react';
import { listDiscountRules } from '@/app/actions/marketing/discount-rule-actions';
import type { DiscountRule } from '@/lib/types/payment';

interface UseDiscountRulesParams {
  search?: string;
  page?: number;
}

/**
 * Hook to list and paginate discount rules for the current tenant.
 */
export function useDiscountRules(params: UseDiscountRulesParams = {}) {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    listDiscountRules({ page: params.page, search: params.search }).then((result) => {
      if (cancelled) return;
      if (result.success === false) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      setRules(result.data);
      setTotal(result.total);
      setError(null);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [params.page, params.search, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  return { rules, total, isLoading, error, refetch };
}
